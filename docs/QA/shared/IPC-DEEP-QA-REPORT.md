# IPC 모듈 심층 QA 리포트
**작성일**: 2025-10-27  
**검토 대상**: `src/shared/ipc/`  
**관점**: 비관적 (보안/안정성/성능 중심)

---

## 1️⃣ 타입 안전성 (Type Safety)

### 1.1 문제: 채널별 타입 오버로드 부재 ⚠️

**현재 상태**:
```typescript
// ❌ 타입 없음 - 런타임 에러 위험
const result = await ipcRenderer.invoke('browser:navigateTo', { wrongKey: 'value' });
// ← args 타입 검증 없음, 런타임까지 모름
```

**문제**:
- `invoke<T>(channel: string, args?: unknown): Promise<T>`
- 모든 채널이 동일한 시그니처 사용
- 채널별 args 구조 검증 불가
- 반환 타입 T도 unconstrained

**영향**:
- 🔴 High: 타입 오류가 런타임에 발견 (크래시 위험)
- 개발 생산성 저하 (자동완성 없음)

**해결 방안**:
```typescript
// ✅ 채널별 오버로드
interface IpcChannelMap {
  'browser:navigateTo': { args: { url: string; target?: '_blank' }; response: boolean };
  'browser:goBack': { args: never; response: boolean };
  'tab:create': { args: { url: string }; response: { tabId: string } };
}

type InvokeChannel = keyof IpcChannelMap;

async function invoke<C extends InvokeChannel>(
  channel: C,
  args?: IpcChannelMap[C]['args']
): Promise<IpcChannelMap[C]['response']> {
  // 타입 검증됨
}
```

---

### 1.2 문제: IpcResponse 판별식 취약 ⚠️

**현재 상태**:
```typescript
export type IpcResponse<T> = IpcResponseSuccess<T> | IpcResponseError;

interface IpcResponseSuccess<T> {
  status: 'success';
  data: T;
}

interface IpcResponseError {
  status: 'error';
  code: string;
  message: string;
  details?: unknown;
}
```

**문제**:
- `status` 필드만 판별 → 약함
- `T`가 `{ status, ...anything }` 형태면 충돌 가능
- 재귀 응답 처리 시 타입 모호성

**예시 (충돌)**:
```typescript
const response: IpcResponse<{ status: 'pending'; data: string }> = {
  status: 'success',
  data: { status: 'pending', data: 'value' }
};
// ← 내부 'pending' status와 외부 'success' 구분 불명확
```

---

### 1.3 문제: 제네릭 제약 부재 🔴

**현재**:
```typescript
type IpcResponse<T> = IpcResponseSuccess<T> | IpcResponseError;
// T에 제약 없음 - 무엇이든 가능
```

**문제**:
- `T = never` 허용 → 불가능한 상태
- `T = any` → 타입 이점 상실
- `T = Function` → 직렬화 불가
- `T = Error` → 직렬화 불가

**위험한 예**:
```typescript
const badResponse: IpcResponse<(x: number) => number> = {
  status: 'success',
  data: (x) => x * 2  // ❌ 함수는 직렬화 불가!
};

// JSON.stringify 실패 → 런타임 크래시
```

---

## 2️⃣ 에러 처리 (Error Handling)

### 2.1 문제: 에러 타입 검증 누락 ⚠️

**현재 상태**:
```typescript
export function handleIpcError(error: unknown, context?: ErrorContext): IpcResponse {
  if (error instanceof BaseError) {
    return {
      status: 'error',
      code: error.code,
      message: error.message,
      details: error.context
    };
  }
  
  // ❌ 다른 타입? 그냥 무시됨
  return {
    status: 'error',
    code: 'E_ZEN_UNKNOWN',
    message: 'Unknown error'
  };
}
```

**문제**:
- `Error` 객체 → 스택 트레이스 손실
- 문자열 에러 → 컨텍스트 없음
- 숫자, 객체 에러 → 무시됨
- 에러 체인 손실

**실제 사례**:
```typescript
try {
  throw new TypeError('Invalid argument');
} catch (e) {
  return handleIpcError(e);  // ← 단순 메시지만 반환
  // TypeError 정보 모두 손실!
}
```

---

### 2.2 문제: 메시지 크기 제한 부재 🔴

**현재**:
```typescript
interface IpcResponseError {
  status: 'error';
  code: string;
  message: string;        // ← 크기 제한 없음!
  details?: unknown;      // ← 크기 제한 없음!
}
```

**문제**:
- 매우 긴 메시지 → IPC 프로세스 간 버퍼 오버플로우
- 큰 details 객체 → 메모리 폭증
- DoS 공격 가능

**공격 시나리오**:
```typescript
const response: IpcResponseError = {
  status: 'error',
  code: 'E_LARGE',
  message: 'x'.repeat(1024 * 1024),  // ← 1MB 문자열!
  details: Array(1000000).fill({ deep: { nested: { obj: {} } } })
};
// ← IPC 채널 마비, 프로세스 메모리 폭증
```

---

### 2.3 문제: 에러 정보 노출 ⚠️

**현재 상태**:
```typescript
// ValidationError
class ValidationError extends BaseError {
  constructor(field: string, reason: string) {
    super('E_ZEN_VALIDATION', `${field}: ${reason}`);
    this.context = { field, reason };  // ← details로 노출됨
  }
}

// IPC 응답
{
  status: 'error',
  code: 'E_ZEN_VALIDATION',
  message: 'password: must contain uppercase',
  details: { field: 'password', reason: 'must contain uppercase' }
}
```

**문제**:
- 유효성 검증 규칙 노출 → 공격자에게 정보 제공
- 내부 구조 노출
- 데이터베이스 에러 메시지 노출 가능

**보안 위험**:
```
공격자 → 테스트 → 에러 메시지 분석 → 패턴 파악 → 우회
```

---

## 3️⃣ 유효성 검증 (Validation)

### 3.1 문제: 채널명 검증 부재 🔴

**현재**:
```typescript
export interface IpcChannels {
  // 63개 채널 하드코딩
  'browser:navigateTo': { args: any; response: any };
  'tab:create': { args: any; response: any };
  // ...
}

// 런타임에만 에러 감지
ipcRenderer.invoke('browser:navigatToX');  // ← 오타! 타입 에러도 없음
```

**문제**:
- 채널명 오타 → 핸들러 못 찾음
- 런타임 에러 (타입체크 통과)
- 리팩토링 시 채널명 변경 감지 불가

---

### 3.2 문제: Args 구조 검증 없음 ⚠️

**현재**:
```typescript
// validators.ts
export function validateBrowserNavigateArgs(args: any): boolean {
  return (
    typeof args === 'object' &&
    typeof args.url === 'string' &&
    args.url.length > 0 &&
    args.url.length <= 2048  // ← 임의의 제한
  );
}
```

**문제**:
- 검증 함수들이 조각조각
- 채널 핸들러에서 호출 여부 불명확
- 검증 규칙이 하드코딩
- 실패 시 대응 방식 불일치

**예시**:
```typescript
// ❌ 어떤 핸들러는 검증 안 함
ipcMain.handle('tab:create', (event, args) => {
  // args 검증 없음 → undefined 접근 위험
  return createTab(args.url);
});

// ✅ 어떤 핸들러는 검증 함
ipcMain.handle('browser:navigateTo', (event, args) => {
  if (!validateBrowserNavigateArgs(args)) {
    throw new ValidationError('url', 'invalid');
  }
  return navigateTo(args.url);
});
```

---

## 4️⃣ 순환 참조 (Circular References)

### 4.1 문제: 모듈 간 순환 의존성 위험 ⚠️

**현재**:
```
shared/ipc/channels.ts
  ↓ imports
shared/ipc/validators.ts
  ↓ imports
shared/utils/validation.ts
  ↓ imports (?)
shared/ipc/types.ts  ← 순환!
```

**문제**:
- 순환 require 가능
- 번들러 최적화 방해
- 핫 리로드 실패

---

## 5️⃣ 성능 (Performance)

### 5.1 문제: 메시지 직렬화 성능 🔴

**현재**:
```typescript
// Main process → Renderer
const largeData = Array(1000000).fill({
  id: generateUUID(),
  timestamp: new Date(),
  nested: { /* 깊은 중첩 */ }
});

await ipcMain.emit('channel:update', largeData);
// ← 직렬화 성능 측정 없음
// ← 큰 메시지 분할 전략 없음
```

**문제**:
- 1MB 이상 메시지 → 성능 저하
- 직렬화 형식 명시 안 됨 (JSON?)
- 압축 전략 없음

---

### 5.2 문제: 핸들러 등록 검증 부재 ⚠️

**현재**:
```typescript
// 등록 순서 문제
ipcMain.handle('tab:create', handler1);
ipcMain.handle('tab:create', handler2);  // ← 덮어쓰기 (경고 없음)

// 런타임까지 모름 → handler2만 실행됨
```

**문제**:
- 중복 등록 감지 불가
- 등록 순서 의존성
- 핸들러 누락 감지 불가

---

## 6️⃣ 핸들러 에러 전파 (Error Propagation)

### 6.1 문제: 비동기 에러 누락 ⚠️

**현재**:
```typescript
ipcMain.handle('tab:load', async (event, args) => {
  const content = await fetchContent(args.url);
  // 예상: JSON 반환
  // 실제: 프로미스 거부 → ?
  
  setTimeout(() => {
    throw new Error('Async error');  // ← 포착 안 됨!
  }, 1000);
  
  return { success: true };
});
```

**문제**:
- 핸들러 내 비동기 에러 처리 불명확
- 타임아웃 에러 처리 불가
- Promise 거부 → IpcResponseError 변환 안 됨

---

## 7️⃣ 응답 타입 검증

### 7.1 문제: 응답 구조 검증 없음 🔴

**현재**:
```typescript
interface IpcResponseSuccess<T> {
  status: 'success';
  data: T;  // ← 아무거나 가능
}

// 핸들러 반환값 검증 없음
ipcMain.handle('browser:getVersion', () => {
  return { version: '1.0' };  // ← 직렬화 가능? 함수 포함? 모름
});
```

**문제**:
- 반환값 구조 검증 없음
- T 타입 실제 값 검증 없음
- Date, Error 객체 자동 직렬화 불가

---

## 8️⃣ 테스트 커버리지

### 8.1 현재 테스트 상태

**missing**:
- ❌ 채널별 타입 안전성
- ❌ 에러 처리 통합
- ❌ 메시지 크기 제한
- ❌ 순환 참조
- ❌ 핸들러 중복 등록
- ❌ 비동기 에러 전파
- ❌ 응답 검증

---

## 🎯 권장 우선순위 (Priority)

| ID | 항목 | 심각도 | 노력 | 우선순위 |
|---|------|--------|------|----------|
| 1.1 | 채널별 타입 오버로드 | 🟡 High | 🔴 5일 | P0 |
| 2.1 | 에러 타입 검증 | 🟡 High | 🟢 1일 | P0 |
| 2.2 | 메시지 크기 제한 | 🔴 Critical | 🟢 1일 | P0 |
| 2.3 | 에러 정보 노출 | 🔴 Critical | 🟡 2일 | P0 |
| 3.1 | 채널명 검증 | 🟡 High | 🟡 2일 | P1 |
| 3.2 | Args 구조 검증 | 🟡 High | 🟢 1일 | P1 |
| 6.1 | 비동기 에러 전파 | 🟡 High | 🟢 1일 | P1 |
| 7.1 | 응답 검증 | 🟡 High | 🟢 1일 | P1 |

---

## 📋 액션 아이템

### Immediate (이번 스프린트)
- [ ] 채널별 타입 맵 생성 (IpcChannelMap)
- [ ] 메시지 크기 제한 추가 (MAX_MESSAGE_SIZE = 10MB)
- [ ] 에러 정보 필터링 (민감 정보 제거)

### Next Sprint
- [ ] Args 검증 자동화
- [ ] 핸들러 레지스트리 구현
- [ ] 비동기 에러 처리 통합

### Backlog
- [ ] 메시지 압축 (gzip)
- [ ] 대용량 전송 청킹
- [ ] 모니터링 (IPC 성능 메트릭)

---

## 체크리스트

- [ ] IPC 채널 타입 안전성 구현
- [ ] 에러 처리 통합 테스트 (60+ cases)
- [ ] 메시지 크기 제한 enforcement
- [ ] 보안 검토 (OWASP)
- [ ] 성능 벤치마크 (메시지 크기별)
- [ ] 통합 테스트 (Main ↔ Renderer)
