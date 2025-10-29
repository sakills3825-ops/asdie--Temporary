# Types/Constants/Errors 모듈 심층 QA 리포트
**작성일**: 2025-10-27  
**검토 대상**: `src/shared/types/`, `src/shared/constants/`, `src/shared/errors/`  
**관점**: 비관적 (설계/유지보수성 중심)

---

## 1️⃣ Types 모듈 (타입 정의)

### 1.1 문제: 타입 제약 조건 부재 🔴

**현재** (`types/` 추정):
```typescript
export interface LogContext {
  processType?: 'main' | 'renderer';
  module?: string;
  userId?: string;
  metadata?: Record<string, unknown>;  // ← 무제한
}

// 문제: metadata에 아무거나 가능
const badContext: LogContext = {
  metadata: {
    recursiveObj: null  // ← 순환 참조?
  }
};
```

**문제점**:
- `Record<string, unknown>`: 어떤 값이든 가능
- 직렬화 불가능한 타입 가능 (Function, Error, Symbol)
- 크기 제한 없음 (메모리 폭발 가능)

---

### 1.2 문제: 상호 배타적 필드 정의 부재 ⚠️

**현재** (추정):
```typescript
// IPC 응답
export type IpcResponse<T> = IpcResponseSuccess<T> | IpcResponseError;

interface IpcResponseSuccess<T> {
  status: 'success';
  data: T;
  error?: undefined;  // ← 명시적 제거? (TS 4.4+)
}

interface IpcResponseError {
  status: 'error';
  code: string;
  message: string;
  data?: undefined;  // ← 명시적 제거?
}
```

**문제**:
```typescript
// 여전히 가능한 잘못된 상태
const bad: IpcResponse<string> = {
  status: 'success',
  data: 'ok',
  error: new Error('unexpected')  // ← TypeScript 통과?
};
```

---

### 1.3 문제: 선택적 필드 체인 ⚠️

**현재**:
```typescript
export interface User {
  id: string;
  name?: string;
  email?: string;
  profile?: {
    avatar?: string;
    bio?: string;
    social?: {
      twitter?: string;
      github?: string;
    };
  };
}

// 사용
const user: User = { id: '123' };
user.profile?.social?.twitter?.length  // ← undefined일 가능성
```

**문제**:
- 무한 옵셔널 체인 (null 검사 지옥)
- 타입 안전성 감소
- 런타임 undefined 접근 위험

---

### 1.4 문제: Branded Type 부재 🔴

**현재**:
```typescript
export type TabId = string;
export type UserId = string;
export type HistoryId = string;

// 문제: 모두 string!
const tabId: TabId = userId;  // ← TypeScript 통과!

// 런타임 실패
deleteTab(userId);  // 예상: tabId, 실제: userId
```

**개선**:
```typescript
export type TabId = string & { readonly __brand: 'TabId' };
export type UserId = string & { readonly __brand: 'UserId' };

// 이제 불가능
const tabId: TabId = userId as TabId;  // ← as 강제, 명시적
```

---

### 1.5 문제: 제네릭 제약 부재 🔴

**현재**:
```typescript
export interface DataCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
}

// 문제: T에 제약 없음
const badCache: DataCache<() => void> = {
  get: () => undefined,
  set: () => {},
  // 함수를 캐시? → 메모리 누수, 클로저 참조
};

const worse: DataCache<Symbol> = {
  get: () => Symbol('x'),
  set: () => {},
  // Symbol 캐시? → 직렬화 불가
};
```

---

## 2️⃣ Constants 모듈 (상수)

### 2.1 문제: 값 충돌 및 중복 ⚠️

**현재** (`constants/errorCodes.ts` 추정):
```typescript
export const ERROR_CODES = {
  E_ZEN_UNKNOWN: 'E_ZEN_UNKNOWN',
  E_ZEN_VALIDATION: 'E_ZEN_VALIDATION',
  E_ZEN_FILE_NOT_FOUND: 'E_ZEN_FILE_NOT_FOUND',
  // ...
};

export const ERROR_MESSAGES = {
  E_ZEN_UNKNOWN: 'Unknown error occurred',
  E_ZEN_VALIDATION: 'Validation failed',
  // ...
};
```

**문제**:
```typescript
// 1. 값 중복 (DRY 위반)
const code1 = ERROR_CODES.E_ZEN_UNKNOWN;  // 'E_ZEN_UNKNOWN'
const code2 = 'E_ZEN_UNKNOWN';             // 동일값, 다른 정의
// → 리팩토링 시 불일치 가능

// 2. 타입 안전성 부재
const unknownCode: string = 'E_ZEN_TYPO';  // 타입 검사 안 됨
```

---

### 2.2 문제: 상한선 값 임의적 🔴

**현재**:
```typescript
export const LIMITS = {
  MAX_TABS: 100,
  MAX_HISTORY: 50000,
  MAX_MESSAGE_SIZE: 10485760,  // 10MB
  MAX_CACHE_SIZE: 104857600,   // 100MB
  MAX_WORKERS: 4,
};

// 문제: 왜 이 값들?
// - 100 (탭)? 합리적? 너무 적음? 너무 많음?
// - 50000 (히스토리)? 메모리 영향? 테스트 안 됨?
// - 10MB? 애플리케이션 전용? 글로벌?
```

**필요한 것**:
```typescript
// 값 + 근거
export const LIMITS = {
  MAX_TABS: 100,  // 실험 결과: 4GB 시스템에서 안정적
  MAX_HISTORY: 50000,  // 메모리: ~800MB (측정됨)
  // ...
} as const;

// 근거 문서 (또는 주석)
/**
 * MAX_TABS: 100개
 * - 4GB 시스템: 탭당 40MB × 100 = 4GB (메모리 한계)
 * - 안전율: 실제는 30MB/탭이지만 버스트 고려
 * - 테스트 결과: 100개까지 안정, 150개부터 크래시
 */
```

---

### 2.3 문제: 시간 상수 일관성 ⚠️

**현재** (추정):
```typescript
export const TIMEOUTS = {
  IPC_TIMEOUT: 5000,          // 5초
  HTTP_TIMEOUT: 30000,        // 30초
  GC_CHECK_INTERVAL: 5000,    // 5초 (같은 값!)
  RATE_LIMIT_WINDOW: 60000,   // 1분
  SESSION_TIMEOUT: 1800000,   // 30분
};

export const SAMPLE_INTERVALS = {
  MEMORY_SAMPLE: 5000,        // 5초 (TIMEOUTS와 동일)
  CPU_SAMPLE: 10000,
  NETWORK_SAMPLE: 2000,
};
```

**문제**:
- 5000이 여러 곳에서 다른 목적으로 사용
- 변경 시 모든 곳 수정 필요
- 분석 어려움

---

### 2.4 문제: 헥스 값/매직 넘버 🔴

**현재**:
```typescript
// constants/limits.ts
export const MEMORY_HARD_LIMIT_MB = 950;
export const MAX_MESSAGE_SIZE = 10485760;  // ← 뭔가?
export const BUFFER_SIZE = 0x100000;       // ← 뭔가?

// 사용 코드에서
if (memoryUsage > 950) { }  // ← 왜 950?
if (size > 10485760) { }    // ← 왜 이 값?
```

**필요한 것**:
```typescript
const MAX_MESSAGE_SIZE_MB = 10;  // 명확
const MAX_MESSAGE_SIZE = MAX_MESSAGE_SIZE_MB * 1024 * 1024;  // 계산된 값

// 또는
export const MAX_MESSAGE_SIZE_BYTES = 10 * 1024 * 1024;  // 직접 계산
```

---

## 3️⃣ Errors 모듈 (에러 클래스)

### 3.1 문제: BaseError 구현 불명확 ⚠️

**현재** (`errors/BaseError.ts`):
```typescript
export class BaseError extends Error {
  constructor(
    public code: string,
    public message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    Object.setPrototypeOf(this, BaseError.prototype);  // ← 필요?
  }
}
```

**문제점**:
1. **프로토타입 체인 설정 필요?**
   ```typescript
   // instanceof 검사 작동?
   const err = new BaseError('CODE', 'msg');
   console.log(err instanceof BaseError);  // true 또는 false?
   ```

2. **Error 상속 문제**
   ```typescript
   const err = new BaseError('CODE', 'msg');
   console.log(err.stack);  // 있는가? 없는가?
   ```

3. **name 필드**
   ```typescript
   const err = new BaseError('CODE', 'msg');
   console.log(err.name);  // 'Error'? 'BaseError'?
   ```

---

### 3.2 문제: 에러 코드 충돌 🔴

**현재** (추정):
```typescript
// errors/BaseError.ts에 정의?
export class ValidationError extends BaseError {
  constructor(message: string) {
    super('E_VALIDATION', message);  // ← 코드 하드코딩
  }
}

// errors/AppError.ts에 정의?
export class ConfigError extends BaseError {
  constructor(message: string) {
    super('E_CONFIG', message);  // ← 다른 코드
  }
}

// 문제: 에러 코드가 분산
// → 코드 재사용 불가
// → 중복 가능성
```

**필요한 것**:
```typescript
// constants/errorCodes.ts (단일 소스)
export const ERROR_CODES = {
  VALIDATION: 'E_ZEN_VALIDATION',
  CONFIG: 'E_ZEN_CONFIG',
  // ...
} as const;

// errors/ValidationError.ts
export class ValidationError extends BaseError {
  constructor(message: string) {
    super(ERROR_CODES.VALIDATION, message);  // 참조
  }
}
```

---

### 3.3 문제: 에러 직렬화 불가능 🔴

**현재**:
```typescript
const err = new ValidationError('Invalid input');
err.context = { nested: { error: new Error('inner') } };

// JSON 직렬화?
JSON.stringify(err);
// 결과: "{}"  (모든 필드 손실!)
// 이유: Error 객체는 열거 불가능 (enumerable: false)
```

**테스트**:
```typescript
const err = new BaseError('CODE', 'msg');
const json = JSON.stringify(err);
console.log(json);  // "{}" 또는 null?

// IPC로 전송
ipcRenderer.send('error', err);
// 수신측에서 null 받을 가능성!
```

---

### 3.4 문제: AppError 스펙 불명확 ⚠️

**현재** (`errors/AppError.ts` 추정):
```typescript
export class AppError extends BaseError {
  constructor(
    code: string,
    message: string,
    public statusCode?: number,
    context?: Record<string, unknown>
  ) {
    super(code, message, context);
  }
}
```

**문제**:
1. **statusCode 용도**
   ```typescript
   // HTTP 상태 코드? IPC 상태 코드?
   new AppError('E_AUTH', 'Forbidden', 403);
   new AppError('E_RATE_LIMIT', 'Too many requests', 429);
   ```

2. **상속 관계 혼동**
   ```typescript
   new ValidationError('invalid');        // BaseError 직접 상속
   new AppError('E_VALIDATION', 'invalid', 400);  // AppError 상속
   // 둘 다 사용? 혼동 가능
   ```

---

### 3.5 문제: 에러 체인 손실 🔴

**현재** (추정):
```typescript
try {
  // 데이터베이스 작업
} catch (dbError) {
  // 원본 에러 정보 손실
  throw new AppError('E_DB', 'Database error');
  // dbError (타입, 스택) 모두 손실!
}
```

**필요한 것**:
```typescript
// 에러 체인 유지
throw new AppError('E_DB', 'Database error', 500, {
  original: dbError.message,
  code: dbError.code,
  stack: dbError.stack,
  cause: dbError  // ES2022
});
```

---

## 4️⃣ 타입-상수-에러 통합 문제

### 4.1 문제: 타입과 상수 불일치 ⚠️

**현재**:
```typescript
// types/index.ts
export type ErrorCode = string;  // ← 무제한!

// constants/errorCodes.ts
export const ERROR_CODES = {
  E_VALIDATION: 'E_VALIDATION',
  E_CONFIG: 'E_CONFIG',
};

// 문제: 유효한 코드만 인정 가능하게?
```

**필요한 것**:
```typescript
// types/index.ts
export type ErrorCode = 
  | 'E_VALIDATION'
  | 'E_CONFIG'
  | 'E_UNKNOWN';

// 또는
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// 이제 안전
const code: ErrorCode = 'E_TYPO';  // ← TypeScript 에러!
```

---

### 4.2 문제: 메시지 검증 부재 ⚠️

**현재**:
```typescript
throw new ValidationError('aaaaaa...');  // ← 아무 메시지나 가능

// 문제: 메시지가 너무 길면?
throw new ValidationError('x'.repeat(1000000));  // ← 1MB!
```

**필요한 것**:
```typescript
export class ValidationError extends BaseError {
  constructor(message: string) {
    if (message.length > 1000) {
      throw new Error('Message too long');
    }
    super(ERROR_CODES.VALIDATION, message);
  }
}
```

---

## 5️⃣ 테스트 누락

### 현재 테스트 상태:
- ❌ 타입 제약 검증
- ❌ 상수 값 타입 안전성
- ❌ BaseError 직렬화
- ❌ 에러 코드 충돌
- ❌ 에러 체인 전파
- ❌ Branded types 작동
- ❌ 선택적 필드 체인

---

## 🎯 우선순위

| ID | 항목 | 심각도 | 영향 | 우선순위 |
|---|-----|--------|------|----------|
| 3.1 | BaseError 구현 명확화 | 🟡 High | 중간 | P0 |
| 3.2 | 에러 코드 통합 | 🟡 High | 중간 | P0 |
| 3.3 | 에러 직렬화 | 🔴 Critical | 높음 | P0 |
| 1.4 | Branded Types | 🟡 High | 낮음 | P1 |
| 2.2 | 상한선 값 근거 문서 | 🟡 High | 낮음 | P1 |
| 4.1 | 타입-상수 불일치 | 🟡 High | 중간 | P1 |
| 1.2 | 상호 배타 필드 | 🟢 Medium | 낮음 | P2 |

---

## 📋 액션 아이템

### P0 (즉시)
- [ ] BaseError.name 설정 확인
- [ ] 에러 코드 constants로 통합
- [ ] 에러 직렬화 구현 (toJSON 메서드)
- [ ] 테스트 (에러 직렬화)

### P1 (이번주)
- [ ] Branded Types 구현 (TabId, UserId)
- [ ] 상수 값 근거 문서
- [ ] 타입-상수 매핑

### P2 (다음주)
- [ ] 상호 배타 필드 (제네릭 개선)
- [ ] 에러 체인 전파
- [ ] 통합 테스트 (50+ cases)
