# System 모듈 심층 QA 리포트
**작성일**: 2025-10-27  
**검토 대상**: `src/shared/system/` (constants, policies, enforcers, monitoring, capabilities)  
**관점**: 비관적 (설계/성능/안정성 중심)

---

## 1️⃣ 동적 계산 정확성 (Calculation Accuracy)

### 1.1 문제: calculateMaxTabs() 경계값 처리 ⚠️

**현재 구현**:
```typescript
export function calculateMaxTabs(totalMemoryMB?: number, currentUsagePercent?: number): number {
  const total = totalMemoryMB || Math.round(os.totalmem() / 1024 / 1024);
  // ... 계산
  return Math.max(5, Math.min(maxTabs, 100));
}
```

**문제 케이스**:

1. **극저사양 (512MB)**:
   ```typescript
   calculateMaxTabs(512)  // → 5 (최소값)
   // 문제: 5개 탭도 메모리 부족 (200MB)
   // 권장: 2-3개로 제한?
   ```

2. **극고사양 (128GB)**:
   ```typescript
   calculateMaxTabs(128 * 1024)  // → 100 (최대값)
   // 문제: 128GB에서 100개 탭은 낭비
   // 권장: 300-500개?
   ```

3. **중간값 충돌**:
   ```typescript
   calculateMaxTabs(4096, 50)   // → X개
   calculateMaxTabs(4096, 50.1) // → Y개 (다를 수 있음)
   // 문제: 0.1% 차이로 결과 급변?
   ```

---

### 1.2 문제: calculateGCThreshold() 부동소수점 오류 🔴

**현재**:
```typescript
export function calculateGCThreshold(totalMemoryMB?: number): number {
  const total = totalMemoryMB || Math.round(os.totalmem() / 1024 / 1024);
  const availableMB = total * 0.8;
  const gcThresholdMB = availableMB * 0.7;
  return Math.max(150, Math.min(Math.round(gcThresholdMB), 800));
}
```

**문제**:
```typescript
calculateGCThreshold(1000)
// = 1000 * 0.8 * 0.7 = 560
// ✓ 정상

calculateGCThreshold(1001)
// = 1001 * 0.8 * 0.7 = 560.56 → Math.round() = 561
// ❌ 1MB 차이로 1MB 증가 (불연속)

// 더 나쁜 경우:
calculateGCThreshold(999)  // 559
calculateGCThreshold(1001) // 561
// 2MB 점프!
```

**영향**: 
- 캐시 정리 조건 예측 불가
- 임계값 진동 가능 (559 → 561 → 559)

---

### 1.3 문제: calculateMaxHistory() 계층 경계 애매 ⚠️

**현재**:
```typescript
export function calculateMaxHistory(totalMemoryMB?: number): number {
  const total = totalMemoryMB || Math.round(os.totalmem() / 1024 / 1024);
  
  if (total < 1024) return 1000;       // < 1GB
  if (total < 4096) return 10000;      // 1-4GB
  return Math.min(total * 2.5, 50000); // > 4GB
}
```

**문제**:

1. **경계 충돌**:
   ```typescript
   calculateMaxHistory(1023)   // → 1000
   calculateMaxHistory(1024)   // → 10000 (10배!)
   calculateMaxHistory(4095)   // → 10000
   calculateMaxHistory(4096)   // → 10240 (≈1%)
   ```

2. **고메모리 선형성**:
   ```typescript
   calculateMaxHistory(8192)   // → 20480
   calculateMaxHistory(16384)  // → 40960
   calculateMaxHistory(32768)  // → 50000 (캡)
   // 점프점 없고 선형인데, 왜 갑자기 1000→10000?
   ```

3. **대칭성 문제**:
   ```typescript
   // 역함수 없음 - 특정 히스토리 수에 대한 필요 메모리 계산 불가
   whatMemoryForHistory(5000)?  // 모르겠음
   ```

---

### 1.4 문제: calculateIPCTimeout() 실제 RTT 데이터 없음 🔴

**현재**:
```typescript
export function calculateIPCTimeout(rttMs?: number): number {
  const rtt = rttMs || 50;  // 기본값
  return Math.max(5000, Math.min(rtt * 600, 120000));
}
```

**문제**:
- RTT 측정 로직 없음
- 기본값 50ms 임의적
- 600배 배수도 임의적
- 실제 IPC 성능 데이터 없음

**위험**:
```typescript
// 느린 시스템
calculateIPCTimeout()  // 50ms → 30000ms (30초!)
// 30초 대기 → UX 최악

// 빠른 시스템
calculateIPCTimeout(10) // 10ms → 6000ms (6초!)
// 과도함
```

---

## 2️⃣ 정책 충돌 (Policy Conflicts)

### 2.1 문제: 메모리/CPU/배터리 정책 우선순위 불명확 ⚠️

**현재** (`policies/index.ts`):
```typescript
// 우선순위 주석: 배터리 > 메모리 > CPU > 네트워크
const actions = [
  ...batteryActions,
  ...memoryActions,
  ...cpuActions,
  ...networkActions
];
```

**문제 시나리오**:

```typescript
// 상황: 배터리 5% + 메모리 90% + CPU 80% + 네트워크 느림

// 배터리 정책
batteryActions = [
  'reduce-video-quality',
  'disable-background-sync',
  'disable-plugins'
];

// 메모리 정책
memoryActions = [
  'unload-background-tabs',
  'clear-cache',
  'reduce-buffer'
];

// 합쳐진 액션 (순서?):
// [배터리들... 메모리들... CPU들... 네트워크들]
// 문제: 같은 항목 중복? (예: reduce-buffer, reduce-quality)
// 문제: 순서에 의존? (어느 정책이 먼저 실행?)
```

**구체적 충돌**:
```typescript
// 배터리: 모든 백그라운드 작업 중단
// 메모리: 백그라운드 탭 언로드
// → 중복 액션

// CPU: CPU 높이면 배터리 빨리 소모
// 배터리: 배터리 위기면 CPU 제한
// → 순환 논리 (deadlock 가능)

// 메모리: 캐시 정리
// 네트워크: 캐시 사용하여 오프라인 모드
// → 모순 (캐시 정리 후 오프라인?)
```

---

### 2.2 문제: Enforcer 액션 실패 처리 없음 🔴

**현재** (`enforcers/memory.ts`):
```typescript
private async optimize(currentMemoryMB: number): Promise<MemoryAction[]> {
  const actions: MemoryAction[] = [];
  
  if (currentMemoryMB > this.gcThresholdMB) {
    try {
      const cleared = await this.clearCache();
      actions.push('cache-clear');
    } catch (err) {
      console.error('Cache clear failed:', err);  // ← 로그만, 진행
    }
  }
  
  if (currentMemoryMB > this.criticalThresholdMB) {
    try {
      const unloaded = await this.unloadBackgroundTabs();
      actions.push('background-tabs-unload');
    } catch (err) {
      console.error('Unload failed:', err);      // ← 로그만, 진행
    }
  }
  
  return actions;  // 실제로는 어떤 액션도 성공했는지 모름!
}
```

**문제**:
- 액션 성공/실패 추적 없음
- 메모리가 여전히 높음 → 다음 액션?
- 재시도 로직 없음
- 롤백 로직 없음

**결과**:
```typescript
// 메모리 90% → 액션들 반환 → 실제로 해제 안 됨 → 메모리 여전히 90%
// 다음 체크까지 기다림 (동안 크래시 가능)
```

---

## 3️⃣ 모니터링 정확성 (Monitoring Precision)

### 3.1 문제: 메모리 메트릭 일관성 🔴

**현재** (`monitoring.ts`):
```typescript
private collectMetrics(): MemoryMetrics {
  const usage = process.memoryUsage();
  
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024),
    rss: Math.round(usage.rss / 1024 / 1024),
    pressure: this.calculatePressure(usage)
  };
}
```

**문제**:

1. **메트릭 타입 혼동**:
   ```
   heapUsed (V8 힙)     vs
   rss (프로세스 물리 메모리)  vs
   external (네이티브 메모리)
   
   → 어느 값을 임계값과 비교? 명시 안 됨
   ```

2. **Pressure 계산**:
   ```typescript
   private calculatePressure(usage: NodeJS.MemoryUsage): number {
     const total = os.totalmem();
     const used = usage.rss;  // rss? heapUsed?
     return Math.min(1, used / (total * 0.8));  // 0.8은?
   }
   ```
   
   문제:
   - rss vs heapUsed 일관성 없음
   - 0.8 팩터 임의적
   - Pressure 정의 애매 (0-1 범위는? 0.5 = 50% 사용?)

3. **시스템 메모리 vs 프로세스 메모리**:
   ```typescript
   // 계산 1: 시스템 기준
   const avail = os.freemem();
   
   // 계산 2: 프로세스 기준
   const heapUsed = process.memoryUsage().heapUsed;
   
   // 둘 다 사용? → 불일치 가능
   ```

---

### 3.2 문제: 메트릭 샘플링 간격 고정 ⚠️

**현재**:
```typescript
private readonly SAMPLE_INTERVAL_MS = 5000;  // 5초 고정

start(): void {
  this.timer = setInterval(() => {
    const metrics = this.collectMetrics();
    this.history.push(metrics);
  }, this.SAMPLE_INTERVAL_MS);
}
```

**문제**:
- 5초: 빠른 변화 감지 못 함
- 5초: 높은 시스템 부하 (200 samples/1000s)
- 고정 간격: 리소스 상태 무시

**실제 위험**:
```typescript
// 시간 0초: 메모리 30%
// 시간 2초: 메모리 95% (심각) ← 놓침!
// 시간 5초: 샘플 (95% 감지, 이미 늦음)
```

---

### 3.3 문제: 평균값 신뢰성 🔴

**현재**:
```typescript
public getAveragePressure(windowMs: number = 60000): number {
  const cutoff = Date.now() - windowMs;
  const samples = this.history.filter(m => m.timestamp > cutoff);
  
  if (samples.length === 0) return 0;
  
  const sum = samples.reduce((acc, m) => acc + m.pressure, 0);
  return sum / samples.length;
}
```

**문제**:
- 단순 평균: 스파이크 무시
- 극값(outlier) 영향력 작음

**예시**:
```typescript
// 샘플: [0.1, 0.2, 0.15, 0.1, 0.95] (마지막 스파이크)
// 평균: 0.28 (낮음)
// 하지만 0.95는 크래시 직전!
// → "평균적으로 안정" 거짓말
```

**개선**:
- Percentile 95 사용?
- 최대값 추적?
- 표준편차 계산?

---

## 4️⃣ 종료 조건 (Termination Conditions)

### 4.1 문제: 메모리 압박 해제 조건 없음 ⚠️

**현재** (`policies/memory.ts`):
```typescript
getStatus(): MemoryStatus {
  if (current > this.hardLimitMB) return 'emergency';
  if (current > this.criticalThresholdMB) return 'critical';
  if (current > this.gcThresholdMB) return 'warning';
  return 'healthy';
}

// 문제: 한 번 emergency → 언제 normal로?
// 조건 없음!
```

**결과**:
```typescript
// 상황: 메모리 900MB (emergency)
// → 탭 강제 언로드
// → 메모리 400MB (healthy)
// 하지만 상태는 여전히 emergency?
// (또는 이전 상태 캐시?)

// 진동 위험: 450MB ↔ 550MB (emergency ↔ warning)
```

---

### 4.2 문제: 액션 복구 불가능 🔴

**현재**:
```typescript
async unloadBackgroundTabs(): Promise<number> {
  const unloaded = backgroundTabs.filter(tab => {
    closeTab(tab.id);  // ← 지우기만, 복구 방법 없음
    return true;
  });
  return unloaded.length;
}
```

**문제**:
- 한 번 닫은 탭 복구 불가
- 메모리 감지 오류 → 필요한 탭도 닫힘
- 사용자 작업 손실

---

## 5️⃣ 동시성 문제 (Concurrency)

### 5.1 문제: Race condition - 여러 정책 동시 실행 ⚠️

**현재**:
```typescript
// 메모리 정책 체크
if (memoryPressure > 0.7) {
  enforcer.optimizeMemory();  // 비동기, 기다리지 않음
}

// 동시에 사용자가 새 탭 생성
if (tabCount < maxTabs) {
  createNewTab();  // 메모리 감소 전에 탭 생성!
}

// 결과: 메모리 최적화 중인데 새 탭 추가 → 메모리 재증가
```

---

### 5.2 문제: 모니터링 중단 감지 없음 🔴

**현재**:
```typescript
start(): void {
  this.timer = setInterval(() => {
    const metrics = this.collectMetrics();
    this.history.push(metrics);
  }, 5000);
  // ← 실패해도 모름
}

stop(): void {
  clearInterval(this.timer);
}

// 문제: collectMetrics() 예외 → 샘플 건너뜀?
// → history 갭 생김
// → 통계 오류
```

---

## 6️⃣ 성능 문제 (Performance)

### 6.1 문제: 계산 복잡도 O(n) ⚠️

**현재** (`monitoring.ts`):
```typescript
public getAveragePressure(windowMs: number = 60000): number {
  const cutoff = Date.now() - windowMs;
  const samples = this.history.filter(m => m.timestamp > cutoff);  // ← O(n)
  
  // history가 무한정 증가? → O(n) 매 호출
  if (samples.length === 0) return 0;
  const sum = samples.reduce((acc, m) => acc + m.pressure, 0);
  return sum / samples.length;
}
```

**문제**:
- 매 5초마다 호출
- history 크기 무제한
- 1시간 = 720개 샘플
- 1일 = 17,280개 샘플 (메모리 누수?)

---

### 6.2 문제: 메모리 누수 가능 🔴

**현재**:
```typescript
private history: MemoryMetrics[] = [];  // 무한정 증가

start(): void {
  this.timer = setInterval(() => {
    const metrics = this.collectMetrics();
    this.history.push(metrics);
    // history 정리 없음! → 메모리 누수
  }, 5000);
}
```

**계산**:
```
MemoryMetrics = {
  heapUsed: number,
  heapTotal: number,
  external: number,
  rss: number,
  pressure: number,
  timestamp: number
}
≈ 48 bytes

5초마다 샘플:
- 1시간: 720 * 48 ≈ 35KB
- 1일: 17,280 * 48 ≈ 828KB
- 1주: 120,960 * 48 ≈ 5.8MB
- 1개월: 518,400 * 48 ≈ 25MB  ← 무시 못할 수준

+ 각 메트릭 객체 오버헤드
+ V8 메모리 구조체 오버헤드
→ 실제: 100MB+ 가능
```

---

## 7️⃣ 테스트 누락

### 현재 테스트 상태:
- ❌ calculateMaxTabs() 경계값 (512MB, 128GB)
- ❌ calculateGCThreshold() 부동소수점
- ❌ calculateMaxHistory() 경계 충돌
- ❌ 정책 충돌 시나리오
- ❌ 메모리 메트릭 일관성
- ❌ Race condition
- ❌ 메모리 누수
- ❌ 액션 복구 불가능

---

## 🎯 우선순위

| ID | 항목 | 심각도 | 영향 | 우선순위 |
|---|-----|--------|------|----------|
| 1.2 | GC 임계값 부동소수점 | 🟡 High | 중간 | P0 |
| 2.1 | 정책 충돌 우선순위 | 🟡 High | 높음 | P0 |
| 2.2 | Enforcer 액션 실패 | 🔴 Critical | 높음 | P0 |
| 3.1 | 메모리 메트릭 혼동 | 🔴 Critical | 높음 | P0 |
| 4.1 | 복구 조건 없음 | 🟡 High | 중간 | P1 |
| 6.2 | 메모리 누수 | 🟡 High | 중간 | P1 |
| 1.3 | 히스토리 경계 | 🟡 High | 낮음 | P2 |

---

## 📋 액션 아이템

### P0 (즉시)
- [ ] GC 임계값 연속성 테스트
- [ ] 정책 충돌 매트릭스 정의
- [ ] 액션 결과 추적 구현

### P1 (이번주)
- [ ] history 크기 제한 (최대 1000개)
- [ ] 메트릭 롤링 윈도우

### P2 (다음주)
- [ ] 히스토리 경계값 재정의
- [ ] Percentile 기반 pressure 계산
