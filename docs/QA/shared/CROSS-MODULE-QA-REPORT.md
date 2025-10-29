# 크로스 모듈 통합 심층 QA 리포트
**작성일**: 2025-10-27  
**검토 범위**: shared 전 모듈 간 상호작용  
**관점**: 비관적 (의존성/메모리/보안 통합 중심)

---

## 1️⃣ 순환 의존성 (Circular Dependencies)

### 1.1 문제: Logger ↔ Error 순환 🔴

**의존성 그래프**:
```
Logger (shared/logger)
  ├── depends on: Error.BaseError
  │   └── shared/errors/BaseError.ts
  │       └── may log errors? 
  │           └── tries to use Logger?
  └── ERROR ← 순환!
```

**현재 코드** (추정):
```typescript
// shared/errors/BaseError.ts
import { logger } from '../logger';  // ← Logger 임포트?

export class BaseError extends Error {
  constructor(code: string, message: string) {
    super(message);
    logger.debug('Error created', { code });  // ← Logger 호출?
  }
}

// shared/logger/index.ts
import { BaseError } from '../errors';  // ← Error 임포트

export class LoggerImpl implements ILogger {
  error(err: Error) {
    if (err instanceof BaseError) {  // ← 체크
      // ...
    }
  }
}
```

**문제**:
```typescript
// 로드 순서에 따라
// 1. Logger 로드 시작 → Error 필요 → BaseError에서 logger 참조 → undefined!
// 또는
// 2. Error 로드 시작 → Logger 필요 → undefined!

// 결과: 초기화 순서에 따라 runtime error 또는 정상
// → 불안정한 코드!
```

**해결책**:
```typescript
// 1. 순환 참조 제거
// shared/errors/BaseError.ts - Logger 호출 제거
export class BaseError extends Error {
  constructor(code: string, message: string) {
    super(message);
    // logger 호출 제거
  }
}

// 2. 또는 지연 로딩 (Lazy Loading)
// shared/errors/BaseError.ts
let logger: ILogger | undefined;

export const setErrorLogger = (log: ILogger) => {
  logger = log;
};

export class BaseError extends Error {
  constructor(code: string, message: string) {
    super(message);
    logger?.debug('Error created', { code });  // 안전
  }
}

// shared/logger/index.ts
import { setErrorLogger } from '../errors';
const loggerImpl = new LoggerImpl();
setErrorLogger(loggerImpl);  // 명시적 연결
```

---

### 1.2 문제: IPC ↔ Validation 순환 🔴

**의존성 그래프**:
```
IPC (shared/ipc)
  ├── depends on: Validation.Validator
  │   └── shared/utils/validators.ts
  │       └── sends IPC messages?
  │           └── tries to use IPC channel?
  │               └── ERROR ← 순환!
```

**현재 코드** (추정):
```typescript
// shared/ipc/types.ts
import { validateMessage } from '../utils/validators';

export interface IpcChannel<T> {
  validate: (msg: unknown) => { valid: boolean; error?: string };
}

// shared/utils/validators.ts
import { ipcRenderer } from '../ipc';

export const validateMessage = (msg: any) => {
  // IPC로 원격 검증?
  const result = ipcRenderer.invoke('validate', msg);
  return result;
};
```

**문제**:
- IPC 타입 정의가 Validator를 필요
- Validator가 IPC를 필요
- → 모듈 로드 실패

**해결책**:
```typescript
// 1. Validator를 IPC와 독립적으로 구현
// shared/utils/validators.ts
export const validateMessage = (msg: any): ValidationResult => {
  // 로컬 검증만 (IPC 호출 없음)
  return { valid: true, errors: [] };
};

// 2. IPC 검증 로직을 별도 모듈에
// shared/ipc/remote-validation.ts
export const validateMessageRemote = async (msg: any) => {
  const result = await ipcRenderer.invoke('validate', msg);
  return result;
};
```

---

### 1.3 문제: System ↔ Logger 간 메모리 누수 🔴

**의존성 패턴**:
```
System (shared/system)
  ├── uses: Logger (로깅)
  └── manages: Memory monitoring
  
Logger (shared/logger)
  ├── creates: Field builders
  └── stores: Handler references
  
Problem:
Logger가 메모리 레퍼런스 유지
→ System이 정리하려 해도 Logger 때문에 메모리 유지
→ 의도하지 않은 메모리 누수
```

**현재 코드** (추정):
```typescript
// shared/logger/LoggerImpl.ts
private handlers: ILogHandler[] = [];

addHandler(handler: ILogHandler) {
  this.handlers.push(handler);  // ← 영구 저장
}

// shared/system/monitoring.ts
export const startMemoryMonitoring = () => {
  const monitor = (info: MemoryInfo) => {
    logger.info('Memory usage', info);  // ← Logger 호출
  };
  
  setInterval(monitor, 5000);
  // 언제 정리? → 안 함!
};
```

**문제**:
```typescript
// 메모리 모니터링 중단 시
stopMemoryMonitoring();  // ← 콜백 참조가 남음?

// 결과: 메모리 누수
// - monitor 함수 → logger 참조
// - logger → handlers 참조
// - handlers → 메모리 계속 점유
```

**필요한 것**:
```typescript
// shared/logger/LoggerImpl.ts
addHandler(handler: ILogHandler): () => void {
  this.handlers.push(handler);
  
  // 제거 함수 반환 (cleanup)
  return () => {
    const idx = this.handlers.indexOf(handler);
    if (idx > -1) {
      this.handlers.splice(idx, 1);
    }
  };
}

// shared/system/monitoring.ts
export class MemoryMonitoring {
  private stopLogging?: () => void;
  
  start() {
    this.stopLogging = logger.addHandler((...args) => {
      // 로깅
    });
  }
  
  stop() {
    this.stopLogging?.();  // 명시적 정리
    this.stopLogging = undefined;
  }
}
```

---

## 2️⃣ 에러 전파 (Error Propagation)

### 2.1 문제: IPC 에러 손실 🔴

**전파 경로**:
```
Main Process Error
  ↓ (thrown)
IPC Channel (shared/ipc/handler-helper.ts)
  ↓ (converted?)
IPC Response Format
  ↓ (serialized)
IPC Boundary (JSON)
  ↓ (deserialized)
Renderer Process
  ↓ (receives?)
Error Available to App?
```

**현재 코드** (추정):
```typescript
// shared/ipc/handler-helper.ts
export const wrapIpcHandler = <T>(
  handler: () => Promise<T>
): IpcHandler<T> => {
  return async () => {
    try {
      return await handler();
    } catch (err) {
      const appErr = BaseError.from(err);
      return {
        status: 'error',
        code: appErr.code,
        message: appErr.message,
        // context 손실?
      };
    }
  };
};
```

**문제**:
```typescript
// 1. 에러 스택 손실
throw new ValidationError('Invalid user ID', { userId: '...' });
// IPC 응답에는 message만 전달됨

// 2. 컨텍스트 손실
throw new DatabaseError('Connection failed', {
  host: 'db.example.com',
  port: 5432,
  timeout: 5000
});
// IPC 응답: 기본 메시지만 (호스트/포트 정보 손실)

// 3. 렌더러에서 원본 에러 재구성 불가
const response = await ipcRenderer.invoke('...', {});
if (response.status === 'error') {
  console.log(response.message);  // 일반적인 메시지만
  // 추가 정보 불가
}
```

**해결책**:
```typescript
// shared/ipc/types.ts
export interface IpcError {
  code: string;
  message: string;
  context?: Record<string, any>;  // ← 컨텍스트 추가
  statusCode?: number;             // ← HTTP 상태 추가
  details?: string;                // ← 상세 정보
}

// shared/ipc/handler-helper.ts
export const handleIpcError = (
  err: unknown
): IpcError => {
  if (err instanceof BaseError) {
    return {
      code: err.code,
      message: err.message,
      context: err.context,  // ← 컨텍스트 포함
      statusCode: err.statusCode
    };
  }
  
  if (err instanceof Error) {
    return {
      code: 'E_UNKNOWN',
      message: err.message,
      details: err.stack  // ← 스택 정보
    };
  }
  
  return {
    code: 'E_UNKNOWN',
    message: String(err)
  };
};

// renderer/hooks/useIpc.ts
const useIpc = () => {
  return {
    invoke: async (channel, data) => {
      const response = await ipcRenderer.invoke(channel, data);
      
      if (response.status === 'error') {
        // 렌더러에서 에러 재구성
        throw new RemoteError(
          response.code,
          response.message,
          response.context
        );
      }
      
      return response.data;
    }
  };
};
```

---

### 2.2 문제: Logger 에러 무시 🟡

**현재 코드** (추정):
```typescript
// shared/logger/LoggerImpl.ts
private executeHandlers(level: LogLevel, record: LogRecord) {
  for (const handler of this.handlers) {
    try {
      handler(record);
    } catch (err) {
      // 에러 무시?
      console.error('Handler failed:', err);  // ← stderr에만 출력
    }
  }
}
```

**문제**:
```typescript
// 핸들러 에러 발생
logger.info('message', { data });

// 결과:
// 1. 데이터가 제대로 기록되지 않음 (조용히 실패)
// 2. 로그만 stderr에 출력
// 3. 핸들러 복구 안 됨
// 4. 누적 에러 불명확
```

**필요한 것**:
```typescript
// shared/logger/LoggerImpl.ts
private handlerErrors: Array<{ timestamp: number; error: Error }> = [];

private executeHandlers(level: LogLevel, record: LogRecord) {
  for (const handler of this.handlers) {
    try {
      handler(record);
    } catch (err) {
      this.handlerErrors.push({
        timestamp: Date.now(),
        error: err instanceof Error ? err : new Error(String(err))
      });
      
      // 누적 에러가 많으면?
      if (this.handlerErrors.length > 100) {
        this.handlerErrors.shift();  // 오래된 것 제거
      }
    }
  }
}

// 핸들러 상태 확인
getHandlerErrors(): Array<{ timestamp: number; error: Error }> {
  return [...this.handlerErrors];
}
```

---

## 3️⃣ 메모리 관리 (Memory Management)

### 3.1 문제: 캐시 메모리 한계 부재 🔴

**현재 코드** (추정):
```typescript
// shared/utils/ (캐시 구현 추정)
export class SimpleCache<T> {
  private data = new Map<string, T>();
  
  set(key: string, value: T): void {
    this.data.set(key, value);  // ← 크기 제한 없음!
  }
}

// shared/system/optimization.ts
const cache = new SimpleCache<any>();

// 렌더러에서 계속 저장
await ipcRenderer.invoke('cache-set', {
  key: `item_${i}`,
  value: largObject
});
```

**문제**:
```
시간 경과:
T0: 100KB (정상)
T1: 1MB (괜찮음)
T2: 10MB (커지는 중)
T3: 100MB (경고)
T4: 1GB (OOM 위기!)
T5: 크래시 (메모리 초과)
```

**필요한 것**:
```typescript
// shared/utils/cache.ts
export interface CacheOptions {
  maxSize: number;        // 바이트 단위
  maxItems?: number;      // 항목 수
  ttl?: number;           // 밀리초
}

export class LimitedCache<T> {
  private data = new Map<string, { value: T; size: number }>();
  private totalSize = 0;
  
  constructor(private options: CacheOptions) {}
  
  set(key: string, value: T): void {
    const size = this.estimateSize(value);
    
    // 크기 초과?
    if (this.totalSize + size > this.options.maxSize) {
      // LRU 정책으로 제거
      this.evictLRU(size);
    }
    
    if (this.data.has(key)) {
      this.totalSize -= this.data.get(key)!.size;
    }
    
    this.data.set(key, { value, size });
    this.totalSize += size;
  }
  
  private evictLRU(neededSize: number): void {
    // 최근 사용하지 않은 항목 제거
    const entries = Array.from(this.data.entries());
    entries.sort((a, b) => a[1].size - b[1].size);
    
    for (const [key, { size }] of entries) {
      this.data.delete(key);
      this.totalSize -= size;
      
      if (this.totalSize + neededSize <= this.options.maxSize) {
        break;
      }
    }
  }
  
  private estimateSize(obj: any): number {
    // 간단한 크기 추정 (실제로는 v8 API 사용)
    return JSON.stringify(obj).length;
  }
}
```

---

### 3.2 문제: Logger 핸들러 메모리 증가 🟡

**현재 코드** (추정):
```typescript
// shared/logger/LoggerImpl.ts
export class LoggerImpl implements ILogger {
  private handlers: ILogHandler[] = [];
  
  addHandler(handler: ILogHandler): void {
    this.handlers.push(handler);  // 제거 방법 없음?
  }
  
  // removeHandler? 없음!
}

// 사용
const logger = getLogger();
for (let i = 0; i < 1000; i++) {
  logger.addHandler(() => console.log('...'));
}
// 1000개 핸들러 생성! 메모리 누수!
```

**문제**:
- 핸들러 제거 메서드 없음
- 테스트에서 핸들러 등록 → 정리 안 됨
- 누적 메모리 증가

**필요한 것**:
```typescript
// shared/logger/LoggerImpl.ts
export class LoggerImpl implements ILogger {
  private handlers: ILogHandler[] = [];
  
  addHandler(handler: ILogHandler): () => void {
    this.handlers.push(handler);
    
    // 제거 함수 반환
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx > -1) {
        this.handlers.splice(idx, 1);
      }
    };
  }
  
  // 또는 removeHandler
  removeHandler(handler: ILogHandler): void {
    const idx = this.handlers.indexOf(handler);
    if (idx > -1) {
      this.handlers.splice(idx, 1);
    }
  }
  
  // 모든 핸들러 제거
  clearHandlers(): void {
    this.handlers = [];
  }
}

// 사용
const unsubscribe = logger.addHandler(() => console.log('...'));
// 나중에
unsubscribe();  // 명시적 정리
```

---

## 4️⃣ 보안 통합 (Security Integration)

### 4.1 문제: 에러 정보 노출 🔴

**현재 코드** (추정):
```typescript
// IPC handler (main process)
const handler = async (dbQuery: string) => {
  try {
    return await database.query(dbQuery);
  } catch (err) {
    // 전체 에러 노출?
    throw new AppError(
      'E_DB',
      `Database error: ${err.message}`,
      500,
      { query: dbQuery }  // ← 쿼리 노출!
    );
  }
};

// renderer에서
try {
  await ipcRenderer.invoke('db-query', userInput);
} catch (err) {
  console.error(err);  // ← 민감한 정보 표시?
}
```

**문제**:
```typescript
// 공격자가 볼 수 있는 정보
{
  code: 'E_DB',
  message: 'Database error: Duplicate key on table users(email)',
  context: {
    query: 'INSERT INTO users (email) VALUES (?)',  // ← SQL 쿼리!
  }
}

// 정보:
// 1. 테이블 이름: users
// 2. 컬럼 이름: email
// 3. 제약 조건: UNIQUE
// → SQL 주입 공격에 도움!
```

**필요한 것**:
```typescript
// shared/errors/AppError.ts
export class AppError extends BaseError {
  constructor(
    code: string,
    message: string,
    statusCode?: number,
    context?: Record<string, any>,
    private internalDetails?: string  // ← 내부용
  ) {
    super(code, message, context);
    this.statusCode = statusCode;
  }
  
  // 외부 노출용 (민감 정보 제거)
  toClientResponse() {
    return {
      code: this.code,
      message: this.message,
      // context는 제외!
    };
  }
  
  // 내부용 (전체 정보)
  toInternalLog() {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
      internalDetails: this.internalDetails,
      stack: this.stack
    };
  }
}

// IPC handler
const handler = async (dbQuery: string) => {
  try {
    return await database.query(dbQuery);
  } catch (err) {
    // 로깅 (내부)
    logger.error('Database error', {
      details: err.message,
      query: dbQuery
    });
    
    // 클라이언트에 응답 (민감 정보 제거)
    throw new AppError(
      'E_DB',
      'Database operation failed',
      500,
      undefined,  // context 제외
      `DB Error: ${err.message}`  // 내부만
    );
  }
};

// renderer
try {
  await ipcRenderer.invoke('db-query', userInput);
} catch (err) {
  console.error(err.message);  // "Database operation failed" ← 안전!
}
```

---

### 4.2 문제: IPC 메시지 검증 부재 🔴

**현재 코드** (추정):
```typescript
// main/ipc-handler.ts
ipcMain.handle('get-user-data', async (event, arg) => {
  // arg 검증 없음
  const userData = await db.getUserData(arg.userId);  // ← 뭔가?
  return userData;
});

// renderer에서
const userData = await ipcRenderer.invoke('get-user-data', {
  userId: '123',
  admin: true,  // ← 추가 필드?
});
```

**문제**:
```typescript
// 공격 벡터
await ipcRenderer.invoke('get-user-data', {
  userId: '123',
  isAdmin: true,  // 무시됨
});

// 또는
await ipcRenderer.invoke('get-user-data', {
  userId: "; DELETE FROM users; --",  // ← SQL 주입?
});

// 또는
await ipcRenderer.invoke('get-user-data', {
  userId: Array(1000000).fill('x'),  // ← DoS?
});
```

**필요한 것**:
```typescript
// shared/ipc/validators.ts
import z from 'zod';

const GetUserDataRequest = z.object({
  userId: z.string().uuid(),  // ← UUID만
}).strict();  // ← 추가 필드 금지

// main/ipc-handler.ts
import { GetUserDataRequest } from '../shared/ipc/validators';

ipcMain.handle('get-user-data', async (event, arg) => {
  // 검증
  try {
    const validated = GetUserDataRequest.parse(arg);
    const userData = await db.getUserData(validated.userId);
    return userData;
  } catch (err) {
    throw new ValidationError('Invalid request format');
  }
});
```

---

## 5️⃣ 성능 통합 (Performance Integration)

### 5.1 문제: IPC 호출 병목 🟡

**현재 코드** (추정):
```typescript
// renderer 컴포넌트
const UserProfile = () => {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // 매번 IPC 호출?
    ipcRenderer.invoke('get-user-profile').then(setData);
  }, []);  // ← 렌더링마다?
  
  return <div>{data?.name}</div>;
};

// 또는 목록 렌더링
const UserList = ({ users }) => {
  return users.map(user => (
    <div
      onClick={async () => {
        // 클릭할 때마다 IPC 호출
        const details = await ipcRenderer.invoke('get-user-details', user.id);
      }}
    >
      {user.name}
    </div>
  ));
};
```

**문제**:
```
병목:
1. 100개 사용자 목록
2. 각각 클릭 → IPC 호출
3. IPC → main process → DB 조회 → 응답
4. 100개 × 100ms = 10초 지연!
```

**필요한 것**:
```typescript
// renderer/hooks/useIpcCache.ts
export const useIpcCache = () => {
  const [cache] = useState(() => new Map());
  
  const invoke = async (channel, data) => {
    const key = `${channel}:${JSON.stringify(data)}`;
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = await ipcRenderer.invoke(channel, data);
    cache.set(key, result);
    return result;
  };
  
  return { invoke, cache };
};

// 사용
const UserList = ({ users }) => {
  const { invoke } = useIpcCache();
  
  return users.map(user => (
    <div
      onClick={() => invoke('get-user-details', user.id)}
    >
      {user.name}
    </div>
  ));
};
```

---

## 6️⃣ 테스트 누락

### 현재 테스트 상태:
- ❌ 순환 의존성 감지
- ❌ 에러 전파 체인
- ❌ 메모리 누수 (Logger, 캐시)
- ❌ 에러 정보 노출 방지
- ❌ IPC 메시지 검증
- ❌ 크로스 모듈 통합 시나리오

---

## 🎯 우선순위

| ID | 항목 | 심각도 | 영향 | 우선순위 |
|---|-----|--------|------|----------|
| 1.1 | Logger ↔ Error 순환 | 🔴 Critical | 높음 | P0 |
| 1.2 | IPC ↔ Validation 순환 | 🔴 Critical | 높음 | P0 |
| 2.1 | IPC 에러 손실 | 🔴 Critical | 높음 | P0 |
| 4.1 | 에러 정보 노출 | 🔴 Critical | 높음 | P0 |
| 4.2 | IPC 메시지 검증 부재 | 🔴 Critical | 높음 | P0 |
| 1.3 | System ↔ Logger 메모리 누수 | 🟡 High | 중간 | P1 |
| 3.1 | 캐시 메모리 한계 부재 | 🟡 High | 중간 | P1 |
| 3.2 | Logger 핸들러 메모리 | 🟡 High | 중간 | P1 |
| 5.1 | IPC 호출 병목 | 🟢 Medium | 낮음 | P2 |

---

## 📋 액션 아이템

### P0 (즉시)
- [ ] Logger ↔ Error 순환 제거
- [ ] IPC ↔ Validation 순환 제거
- [ ] IPC 에러 전파 개선 (컨텍스트 포함)
- [ ] 에러 정보 노출 방지 (toClientResponse)
- [ ] IPC 메시지 검증 (Zod)

### P1 (이번주)
- [ ] System ↔ Logger 메모리 누수 방지
- [ ] 캐시 메모리 한계 (LRU)
- [ ] Logger 핸들러 정리 메커니즘
- [ ] 통합 테스트 (50+ cases)

### P2 (다음주)
- [ ] IPC 호출 캐싱 (useIpcCache)
- [ ] 성능 모니터링
- [ ] 크로스 모듈 성능 벤치마크
