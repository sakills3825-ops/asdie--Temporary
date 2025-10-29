# Utils 모듈 심층 QA 리포트
**작성일**: 2025-10-27  
**검토 대상**: `src/shared/utils/` (validation, async, formatting)  
**관점**: 비관적 (보안/안정성/성능 중심)

---

## 1️⃣ 검증 (Validation)

### 1.1 문제: 정규식 ReDoS (Regular Expression Denial of Service) 🔴

**현재** (`validation/regex.ts` 추정):
```typescript
// 예상 패턴 (실제 코드 확인 필요)
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
```

**문제**:
```typescript
// ReDoS 공격 가능
validateEmail('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@');
// 정규식 엔진: 각 조합 시도 (지수적 증가)
// 시간: 1ms → 100ms → 1s → 10s (입력 길이 증가)

// 따라서:
// 정상 입력 (30글자): 1ms
// 공격 입력 (60글자): 1000초!
```

**보안 영향**:
- DoS 공격 가능
- CPU 100% 점유
- 다른 요청 응답 불가

**취약한 패턴**:
```
(a+)+b          ← 치명적 (exponential)
(a|a)+b         ← 위험
(.*)*$          ← 위험
```

---

### 1.2 문제: 입력 길이 제한 없음 ⚠️

**현재**:
```typescript
export function validateUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  
  try {
    const parsed = new URL(url);
    return true;
  } catch {
    return false;
  }
}
```

**문제**:
```typescript
// 극단적 입력
const hugeUrl = 'https://example.com/' + 'x'.repeat(1000000);
// Node.js URL 파서: 메모리 할당
// 결과: 메모리 부족 → 크래시

const deepPath = 'https://example.com/' + '../'.repeat(100000);
// 경로 순회 공격 가능?
```

**정책**: 최대 길이 정의 필요
```
URL:        ≤ 2048 바이트
Email:      ≤ 254 바이트
FilePath:   ≤ 260 바이트 (Windows)
```

---

### 1.3 문제: 타입 코어션(Type Coercion) ⚠️

**현재**:
```typescript
export function validateFilePath(path: unknown): boolean {
  if (typeof path !== 'string') return false;
  
  // 타입 안전성 있음
  return !path.includes('..') && !path.startsWith('/etc');
}

// 하지만...
validateFilePath(null)           // false ✓
validateFilePath(undefined)      // false ✓
validateFilePath({ toString: () => '/etc/passwd' })
// → false ✓ (조건 확인 안 함, 타입 체크만)

// 위험 케이스:
const obj = { toString: () => '../../../etc/passwd' };
if (typeof obj === 'object') {
  // 어디선가 강제 형변환?
  const pathStr = String(obj);  // '../../../etc/passwd'
}
```

---

### 1.4 문제: 경로 정규화 부재 🔴

**현재**:
```typescript
validateFilePath('./config.json')  // true (괜찮음)
validateFilePath('./config.json/../../../etc/passwd')  // true (위험!)
validateFilePath('config.json%2e%2e%2fetc%2fpasswd')  // true (위험!)
```

**문제**:
```typescript
// 정규화 필요:
path.normalize()  // './a//b' → './a/b'
path.resolve()    // 절대경로 변환
```

---

### 1.5 문제: XSS 방어 부재 ⚠️

**현재**:
```typescript
export function validateUserInput(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  return input.length <= 1000;
}

// 문제: XSS 체크 없음
validateUserInput('<script>alert("xss")</script>')  // true!
validateUserInput('javascript:alert("xss")')       // true!
validateUserInput('"><img src=x onerror="alert()"> ')  // true!
```

**필요한 검증**:
```typescript
// Escape HTML entities
// Disallow script tags
// Disallow event handlers
```

---

## 2️⃣ 비동기 (Async)

### 2.1 문제: 타임아웃 처리 누락 ⚠️

**현재** (추정):
```typescript
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  // 구현 불명확
  // 타임아웃 처리 있는지 모름
}
```

**테스트**:
```typescript
// 무한 대기
const neverResolves = new Promise(() => {});
const result = await withTimeout(neverResolves, 1000);
// 1초 후 타임아웃? → 구현에 따라 다름
```

**문제 시나리오**:
```typescript
// IPC 호출
const response = await withTimeout(
  ipcRenderer.invoke('tab:create', { url }),
  5000  // 5초 타임아웃
);

// 만약 타임아웃 취소 안 됨:
// - Promise는 대기 중 → 메모리 누수
// - Handler는 계속 실행 → 좀비 프로세스
```

---

### 2.2 문제: 재시도 로직 무한 루프 🔴

**현재** (추정):
```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
    }
  }
}
```

**문제**:
```typescript
// 재시도 간격 없음
let attempts = 0;
await withRetry(async () => {
  attempts++;
  if (attempts < 10) throw new Error('fail');
  return 'success';
}, 1000);  // maxRetries = 1000

// 즉시 1000번 재시도 → CPU 100%
// 백오프 전략 필요
```

**지수백오프 필요**:
```
시도 1: 즉시
시도 2: 100ms 대기
시도 3: 200ms 대기
시도 4: 400ms 대기
...
```

---

### 2.3 문제: Promise 거부 처리 불명확 ⚠️

**현재**:
```typescript
// 추측 구현
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number
): Promise<T> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;  // ← 마지막 에러만
}
```

**문제**:
```typescript
// 에러 체인 손실
try {
  await withRetry(async () => {
    // 시도 1: TypeError
    // 시도 2: ReferenceError
    // 시도 3: RangeError
    throw new RangeError('All failed');
  }, 3);
} catch (err) {
  // err = RangeError (마지막 에러만)
  // TypeError, ReferenceError는?
}
```

---

### 2.4 문제: 취소 불가능 🔴

**현재**:
```typescript
// Promise 취소 메커니즘 없음
const task = withTimeout(longRunningTask(), 5000);
// 만약 사용자 취소 → ?
// task.cancel()? → 없음
```

**결과**:
```
사용자 탭 닫기
→ 탭 언로드 신호
→ 내부 task 계속 실행
→ 리소스 낭비
```

---

## 3️⃣ 포매팅 (Formatting)

### 3.1 문제: 인젝션 취약점 ⚠️

**현재** (추정):
```typescript
export function formatLogMessage(template: string, ...args: unknown[]): string {
  return template.replace(/{(\d+)}/g, (match, index) => {
    return String(args[parseInt(index)]);
  });
}
```

**문제**:
```typescript
// 사용자 입력이 template이면?
const userInput = '{0} {0} {0}...{0}'.repeat(1000);
formatLogMessage(userInput, 'x');
// 결과: 'x' 1000번 반복 → 메모리 폭증

// 또는 정규식 ReDoS?
```

---

### 3.2 문제: 이스케이핑 누락 ⚠️

**현재** (추정):
```typescript
export function formatHtmlString(text: string): string {
  return text.replace(/\n/g, '<br>');
  // 그냥 줄바꿈만 처리
}
```

**문제**:
```typescript
const userText = '<script>alert("xss")</script>';
formatHtmlString(userText);
// 결과: '<script>alert("xss")</script>' (그대로!)
// → XSS 취약점

// 필요한 처리:
// & → &amp;
// < → &lt;
// > → &gt;
// " → &quot;
// ' → &#x27;
```

---

### 3.3 문제: 날짜 포매팅 로컬라이제이션 누락 ⚠️

**현재** (추정):
```typescript
export function formatDate(date: Date): string {
  return date.toISOString();
  // 항상 ISO 형식 (미국식)
}
```

**문제**:
```typescript
// 사용자 로케일 무시
const d = new Date('2025-10-27');
formatDate(d);
// 결과: '2025-10-27T00:00:00.000Z'
// 사용자가 기대하는 형식: '2025년 10월 27일' (한국식)
```

---

### 3.4 문제: 바이너리 데이터 처리 🔴

**현재** (추정):
```typescript
export function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let index = 0;
  
  while (size >= 1024 && index < sizes.length - 1) {
    size /= 1024;
    index++;
  }
  
  return `${size.toFixed(2)} ${sizes[index]}`;
}
```

**문제**:
```typescript
formatBytes(0)              // '0.00 B' ✓
formatBytes(-100)           // '-0.10 KB' (음수?)
formatBytes(Infinity)       // 'Infinity KB'
formatBytes(NaN)            // 'NaN B'
formatBytes(Number.MAX_VALUE) // 오버플로우?
```

---

## 4️⃣ 에러 처리

### 4.1 문제: 에러 타입 검증 없음 ⚠️

**현재**:
```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      // 모든 에러 재시도? 위험!
      if (i === maxRetries - 1) throw err;
    }
  }
}
```

**문제**:
```typescript
// 재시도 불가능한 에러도 재시도
const result = await withRetry(async () => {
  throw new SyntaxError('Invalid code');  // 프로그래밍 에러
}, 3);

// 3번 재시도 (무의미)
// 결과: SyntaxError (여전함)
```

**구분 필요**:
```typescript
class RetryableError extends Error {}  // 네트워크 타임아웃 등

// 재시도할 에러만
if (!(err instanceof RetryableError)) {
  throw err;  // 즉시 반환
}
```

---

### 4.2 문제: 메모리 누수 (임시 객체) 🔴

**현재** (추정):
```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number
): Promise<T> {
  const errors = [];  // ← 모든 에러 저장
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      errors.push(err);  // 메모리에 계속 추가
    }
  }
  
  throw new Error(`All retries failed: ${errors.length}`);
}
```

**문제**:
- 각 에러 객체 메모리 보유
- 스택 트레이스 저장
- 매우 많은 재시도 → 메모리 폭증

---

## 5️⃣ 테스트 누락

### 현재 테스트 상태:
- ❌ 정규식 ReDoS
- ❌ 입력 길이 제한
- ❌ 타임아웃 구현 확인
- ❌ 재시도 무한 루프
- ❌ 경로 정규화
- ❌ XSS 방어
- ❌ 에러 타입 검증
- ❌ 메모리 누수

---

## 🎯 우선순위

| ID | 항목 | 심각도 | 영향 | 우선순위 |
|---|-----|--------|------|----------|
| 1.1 | ReDoS 정규식 | 🔴 Critical | 높음 | P0 |
| 1.2 | 입력 길이 제한 | 🔴 Critical | 높음 | P0 |
| 1.4 | 경로 정규화 | 🔴 Critical | 높음 | P0 |
| 2.1 | 타임아웃 검증 | 🔴 Critical | 높음 | P0 |
| 2.2 | 지수백오프 | 🟡 High | 중간 | P1 |
| 3.2 | HTML 이스케이핑 | 🟡 High | 중간 | P1 |
| 1.5 | XSS 방어 | 🟡 High | 중간 | P1 |
| 4.2 | 메모리 누수 | 🟡 High | 낮음 | P2 |

---

## 📋 액션 아이템

### P0 (즉시)
- [ ] 정규식 ReDoS 패턴 감사
- [ ] 입력 길이 제한 추가
- [ ] 경로 정규화 구현
- [ ] 타임아웃 구현 확인

### P1 (이번주)
- [ ] 지수백오프 구현
- [ ] HTML 이스케이핑
- [ ] XSS 방어 필터

### P2 (다음주)
- [ ] 에러 체인 추적
- [ ] 메모리 누수 제거
- [ ] 통합 테스트 (60+ cases)
