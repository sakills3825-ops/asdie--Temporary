# Shared 레이어 완벽 가이드

## 📋 개요
Main/Renderer 프로세스에서 **반드시 사용**해야 하는 모든 공개 API를 문서화합니다.

---

## 1️⃣ Constants (상수들)

### ERROR_CODES
```typescript
import { ERROR_CODES, type ErrorCode } from '@shared';

// 사용 가능한 에러 코드
ERROR_CODES.VALIDATION_ERROR
ERROR_CODES.IPC_CHANNEL_ERROR
ERROR_CODES.FILE_ERROR
ERROR_CODES.NETWORK_ERROR
ERROR_CODES.DATABASE_ERROR
ERROR_CODES.TIMEOUT_ERROR
ERROR_CODES.NOT_FOUND_ERROR
ERROR_CODES.WINDOW_ERROR
```

### LIMITS
```typescript
import { LIMITS } from '@shared';

LIMITS.MAX_TABS          // 최대 탭 개수
LIMITS.MAX_HISTORY       // 최대 히스토리
LIMITS.MAX_BOOKMARKS     // 최대 북마크
LIMITS.MAX_COOKIES       // 최대 쿠키
LIMITS.MAX_STORAGE_SIZE  // 최대 저장소 크기
// ... 더 많은 limit들
```

### DEBOUNCE_MS & CACHE_DURATION_MS
```typescript
import { DEBOUNCE_MS, CACHE_DURATION_MS } from '@shared';

DEBOUNCE_MS              // 디바운스 시간
CACHE_DURATION_MS        // 캐시 유지 시간
```

---

## 2️⃣ System 최적화 모듈

### 초기 능력 감지 (Capabilities)
```typescript
import {
  getAllCapabilities,
  getGPUCapabilities,
  getCPUCapabilities,
  getMemoryCapabilities,
  getNetworkCapabilities,
  getBatteryCapabilities,
  type SystemCapabilities,
  type MemoryTier,
  type NetworkTier,
  type GPUTier,
} from '@shared/system';

// 전체 시스템 능력 한 번에 감지
const capabilities = await getAllCapabilities();
// {
//   gpu: { tier: 'high', ... },
//   cpu: { cores: 8, ... },
//   memory: { tier: 'high', totalMB: 16000, ... },
//   network: { tier: '5g', ... },
//   battery: { ... }
// }

// 개별 감지
const gpuCaps = await getGPUCapabilities();
const cpuCaps = await getCPUCapabilities();
const memCaps = await getMemoryCapabilities();
const netCaps = await getNetworkCapabilities();
const batCaps = await getBatteryCapabilities();
```

### 실시간 모니터링 (Monitoring)
```typescript
import {
  SystemMonitor,
  CPUMonitor,
  MemoryMonitor,
  NetworkMonitor,
  type CPUMetrics,
  type MemoryMetrics,
  type NetworkMetrics,
} from '@shared/system';

// 통합 모니터
const monitor = new SystemMonitor();
monitor.start(1000); // 1초 간격으로 모니터링 시작

// CPU 메트릭
monitor.cpu.getMetrics();    // { usage: 45, temp: 65, ... }

// 메모리 메트릭
monitor.memory.getMetrics(); // { used: 8000, free: 8000, ... }

// 네트워크 메트릭
monitor.network.getMetrics(); // { downMbps: 100, upMbps: 50, ... }

// 중지
monitor.stop();

// 개별 모니터
const cpuMon = new CPUMonitor();
cpuMon.start(1000);
const cpuMetrics = cpuMon.getMetrics();

const memMon = new MemoryMonitor();
memMon.start(1000);
const memMetrics = memMon.getMetrics();
```

### 동적 최적화 (Optimization)
```typescript
import {
  AdaptivePerformance,
  MemoryPressure,
  NetworkAdaptation,
  BatteryOptimization,
  AutoScaling,
  type PerformanceProfile,
  type MemoryCleanupAction,
} from '@shared/system';

// 1. 적응형 성능 프로필
const adaptive = new AdaptivePerformance();
// 'high-performance', 'balanced', 'power-saving'
const profile: PerformanceProfile = 'balanced';

// 2. 메모리 압박 관리
const memPressure = new MemoryPressure();
memPressure.updatePressure(usedMB, hardLimitMB);

// 상태별 액션
const actions = MemoryPressure.getRecommendedActions('high');
// ['cache-clear', 'background-tabs-unload', 'gc-aggressive']

// 3. 네트워크 적응
const netAdapt = new NetworkAdaptation();
// 프로필 분류
const profile = NetworkAdaptation.classifyNetworkProfile(metrics);
// 설정 조회
const settings = NetworkAdaptation.getProfileSettings(profile);

// 4. 배터리 최적화
const batteryOpt = new BatteryOptimization();
batteryOpt.enablePowerSavingMode(true);

// 5. 자동 스케일링
const autoScale = new AutoScaling();
autoScale.adjustResourceLimits(capabilities, metrics);
```

---

## 3️⃣ IPC 채널

### 채널 목록 (IPC_CHANNELS)
```typescript
import { IPC_CHANNELS, isValidIpcChannel } from '@shared';

// 모든 채널 확인
IPC_CHANNELS.SYSTEM_INFO
IPC_CHANNELS.MEMORY_STATUS
IPC_CHANNELS.NETWORK_STATUS
IPC_CHANNELS.BATTERY_STATUS
IPC_CHANNELS.TAB_CREATE
IPC_CHANNELS.TAB_CLOSE
IPC_CHANNELS.CACHE_CLEAR
// ... 더 많은 채널들

// 채널 유효성 검증
isValidIpcChannel('system:info'); // true
```

### IPC 응답 헬퍼
```typescript
import { IpcResponseHelper, type IpcResponse } from '@shared';

// 성공 응답
const success = IpcResponseHelper.success(data);
// { success: true, data: {...} }

// 에러 응답
const error = IpcResponseHelper.error('VALIDATION_ERROR', 'Invalid input');
// { success: false, error: { code: 'VALIDATION_ERROR', message: '...' } }

// 타입
type Response<T> = IpcResponse<T>;
```

---

## 4️⃣ 에러 클래스들

### 내장 에러 클래스
```typescript
import {
  BaseError,
  ValidationError,
  IpcChannelError,
  FileError,
  NetworkError,
  DatabaseError,
  TimeoutError,
  NotFoundError,
  WindowError,
} from '@shared';

// 사용 예
throw new ValidationError('Email is required');
throw new FileError('File not found', 'FILE_NOT_FOUND');
throw new NetworkError('Connection timeout', 'NETWORK_TIMEOUT');
throw new TimeoutError('Operation exceeded 5s', 'TIMEOUT_5S');

// 모든 에러는 다음 속성 보유
// .code: string       // 에러 코드
// .message: string    // 에러 메시지
// .timestamp: Date    // 발생 시간
```

---

## 5️⃣ Validation 유틸리티

### URL 검증
```typescript
import { isValidUrl, validateUrl } from '@shared';

isValidUrl('https://example.com');      // true
validateUrl('https://example.com');     // URL 객체 또는 에러 throw
```

### 파일 경로 검증
```typescript
import { isValidFilePath, validateFilePath } from '@shared';

isValidFilePath('/home/user/file.txt'); // true
validateFilePath('/home/user/file.txt'); // 유효성 검증 또는 에러
```

### 이메일 검증
```typescript
import { isValidEmail } from '@shared';

isValidEmail('user@example.com');       // true
```

### 범위 검증
```typescript
import { validateRange, validateStringLength } from '@shared';

validateRange(50, 0, 100);              // 50 (0-100 범위)
validateStringLength('hello', 3, 10);   // 'hello' (3-10 글자)
```

### 필수 항목 검증
```typescript
import { validateRequired } from '@shared';

validateRequired('value', 'field name'); // 'value' 반환 또는 에러
```

---

## 6️⃣ 비동기 유틸리티

### Timeout 처리
```typescript
import { withTimeout } from '@shared';

const result = await withTimeout(
  fetchData(),
  5000,  // 5초 timeout
  'Fetch operation'
);
```

### Retry 처리
```typescript
import { withRetry } from '@shared';

const result = await withRetry(
  async () => {
    return await riskyOperation();
  },
  { maxAttempts: 3, delayMs: 1000 }
);
```

### 지연
```typescript
import { delay } from '@shared';

await delay(2000); // 2초 대기
```

### 병렬/순차 처리
```typescript
import { parallel, sequential, race } from '@shared';

// 순차 처리
const results = await sequential([
  () => task1(),
  () => task2(),
  () => task3(),
]);

// 병렬 처리
const results = await parallel([
  task1(),
  task2(),
  task3(),
]);

// 경합 (가장 빠른 것)
const result = await race([
  task1(),
  task2(),
]);
```

### 취소 가능한 Promise
```typescript
import { CancelablePromise } from '@shared';

const task = new CancelablePromise((resolve, reject, signal) => {
  // signal.aborted로 취소 여부 확인
  if (signal.aborted) return reject(new Error('Cancelled'));
  
  setTimeout(() => resolve('done'), 5000);
});

task.cancel(); // 취소
```

---

## 7️⃣ 타입 정의

### Domain 타입들
```typescript
import type {
  BrowserTab,
  HistoryEntry,
  Bookmark,
  AppSettings,
  FileDialogOptions,
  AppInfo,
} from '@shared';

// BrowserTab
type BrowserTab = {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  // ...
};

// HistoryEntry
type HistoryEntry = {
  id: string;
  url: string;
  title: string;
  timestamp: number;
  // ...
};
```

### Electron API 타입
```typescript
import type { ElectronAPI } from '@shared';

// Preload에서 정의된 전역 타입
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
```

---

## 📌 Main Process에서 사용 예시

```typescript
import {
  // Constants
  LIMITS,
  ERROR_CODES,
  
  // System optimization
  getAllCapabilities,
  SystemMonitor,
  AdaptivePerformance,
  MemoryPressure,
  
  // IPC
  IPC_CHANNELS,
  IpcResponseHelper,
  
  // Utils
  withTimeout,
  validateUrl,
  
  // Errors
  ValidationError,
  TimeoutError,
} from '@shared';

async function initializeMainProcess() {
  // 1. 시스템 능력 감지
  const capabilities = await getAllCapabilities();
  console.log(`GPU: ${capabilities.gpu.tier}, CPU: ${capabilities.cpu.cores} cores`);
  
  // 2. 모니터링 시작
  const monitor = new SystemMonitor();
  monitor.start(1000);
  
  // 3. 성능 적응화
  const adaptive = new AdaptivePerformance();
  setInterval(() => {
    const memMetrics = monitor.memory.getMetrics();
    if (memMetrics && memMetrics.usedPercent > 80) {
      console.log('⚠️ 메모리 부족: 정리 필요');
      // 메모리 정리 로직
    }
  }, 5000);
  
  // 4. IPC 채널 설정
  ipcMain.handle(IPC_CHANNELS.SYSTEM_INFO, async () => {
    return IpcResponseHelper.success({
      capabilities,
      metrics: monitor.cpu.getMetrics(),
    });
  });
}

// 시작
initializeMainProcess().catch(console.error);
```

---

## ✅ 정리

### Main/Renderer에서 **절대 하드코딩 금지**
❌ `const MAX_TABS = 100;` - 사용금지
✅ `import { LIMITS } from '@shared'; LIMITS.MAX_TABS` - 사용필수

### 사용 가능한 모든 export
- ✅ Constants (ERROR_CODES, LIMITS, DEBOUNCE_MS, CACHE_DURATION_MS)
- ✅ System 최적화 (Capabilities, Monitoring, Optimization)
- ✅ IPC (채널, 헬퍼, 타입)
- ✅ Errors (모든 커스텀 에러)
- ✅ Utils (Validation, Async)
- ✅ Types (Domain, Electron API)

**모든 것을 `@shared`에서 import하세요!**
