# 📊 Shared & Main Process 전체 구조 분석

## 🎯 개요

Electron 앱의 **Shared 레이어**와 **Main 프로세스** 전체 구조를 분석합니다.
- ✅ 공유 레이어의 설계 원칙
- ✅ Main 프로세스의 계층 구조
- ✅ 각 계층의 책임과 역할
- ✅ 데이터 흐름과 의존성

---

## 📦 SHARED 레이어 구조

### 🏗️ 디렉토리 구조

```
src/shared/
├── constants/          # ✅ 앱 전역 상수
│   ├── errorCodes.ts   # 에러 코드 정의
│   ├── limits.ts       # 한계값 (탭 수, 용량 등)
│   └── index.ts
│
├── errors/             # ✅ 에러 클래스
│   ├── BaseError.ts    # 모든 에러의 기반
│   ├── AppError.ts     # 구체적 에러들
│   └── index.ts
│
├── ipc/                # ✅ IPC 통신 (Main ↔ Renderer)
│   ├── channels.ts     # 채널 정의 (직관적 네이밍)
│   ├── types.ts        # IPC 타입 정의
│   ├── validators.ts   # 채널 검증
│   ├── handler-helper.ts # 핸들러 래퍼
│   ├── error-handler.ts # 에러 처리
│   └── index.ts
│
├── logger/             # ✅ 로깅 시스템
│   ├── types.ts        # 로거 인터페이스
│   ├── levels.ts       # 로그 레벨
│   ├── fields.ts       # 로그 필드 빌더
│   ├── symbols.ts      # Symbol 정의
│   ├── LoggerImpl.ts    # 구현체
│   └── index.ts
│
├── platform/           # ✅ 플랫폼 정보
│   ├── environment.ts  # 환경 정보
│   ├── paths.ts        # 경로 유틸리티
│   └── index.ts
│
├── security/           # ✅ 보안 정책
│   ├── authorization.ts # 권한 검증
│   ├── cors.ts         # CORS 정책
│   ├── csp.ts          # CSP 정책
│   ├── rateLimiting.ts # 레이트 제한
│   └── index.ts
│
├── system/             # ✅ 시스템 최적화
│   ├── capabilities.ts # 시스템 능력
│   ├── constants.ts    # 시스템 상수
│   ├── monitoring.ts   # 모니터링
│   ├── optimization.ts # 최적화
│   └── index.ts
│
├── types/              # ✅ 타입 정의
│   ├── domain.ts       # 도메인 타입
│   ├── electron.ts     # Electron API 타입
│   └── index.ts
│
├── utils/              # ✅ 유틸리티 함수
│   ├── validation.ts   # 검증
│   ├── async.ts        # 비동기 헬퍼
│   ├── url.ts          # URL 유틸리티
│   └── index.ts
│
├── __tests__/          # ✅ 테스트
│
└── index.ts            # ✅ 루트 export
```

### 📌 Shared 레이어 핵심 역할

#### 1️⃣ Constants (상수)
```typescript
import { ERROR_CODES, LIMITS } from '@shared';

ERROR_CODES.VALIDATION_ERROR      // 검증 에러
ERROR_CODES.IPC_CHANNEL_ERROR     // IPC 채널 에러
ERROR_CODES.FILE_ERROR            // 파일 에러
LIMITS.MAX_TABS                   // 최대 탭 수
LIMITS.MAX_HISTORY                // 최대 히스토리
```

#### 2️⃣ Errors (에러 처리)
```typescript
import { BaseError, ValidationError, FileError } from '@shared';

class BaseError {
  code: string;           // 에러 코드
  message: string;        // 에러 메시지
  statusCode?: number;    // HTTP 상태 코드
  context?: unknown;      // 추가 정보
}

// 구체적 에러들
throw new ValidationError('Invalid input');
throw new FileError('File not found');
throw new NetworkError('Connection timeout');
```

#### 3️⃣ IPC (프로세스 간 통신)
```typescript
import { IPC_CHANNELS, IpcResponseHelper } from '@shared';

// 채널 정의 (직관적)
IPC_CHANNELS.tabCreateNew          // 'tab:createNew'
IPC_CHANNELS.browserNavigateTo     // 'browser:navigateTo'
IPC_CHANNELS.historyGetAll         // 'history:getAll'

// 응답 헬퍼
IpcResponseHelper.success(data)    // { success: true, data }
IpcResponseHelper.error(msg, code) // { success: false, error, code }
```

#### 4️⃣ Logger (로깅)
```typescript
import { LoggerImpl, LogLevel } from '@shared';

const logger = new LoggerImpl('ModuleName', LogLevel.INFO);

logger.info('메시지', metadata);
logger.warn('경고', metadata);
logger.error('에러', error);
logger.debug('디버그', metadata);
```

---

## 🔧 MAIN PROCESS 구조

### 🏗️ 디렉토리 구조

```
src/main/
├── core/                  # 시스템 핵심
│   ├── appLifecycle.ts    # Electron 앱 생명주기
│   ├── window.ts          # 윈도우 관리
│   ├── EventBus.ts        # 이벤트 발행/구독
│   └── index.ts
│
├── managers/              # 상태 저장소
│   ├── ConfigManager.ts   # 설정 저장/로드
│   ├── TabManager.ts      # 탭 상태
│   ├── HistoryManager.ts  # 히스토리 상태
│   ├── ResourceManager.ts # 리소스 모니터링
│   └── index.ts
│
├── services/              # 비즈니스 로직
│   ├── TabService.ts      # 탭 로직
│   ├── HistoryService.ts  # 히스토리 로직
│   ├── BookmarkService.ts # 북마크 로직
│   ├── WindowService.ts   # 윈도우 로직
│   └── index.ts
│
├── handlers/              # IPC 라우터
│   ├── TabHandler.ts      # 탭 IPC
│   ├── HistoryHandler.ts  # 히스토리 IPC
│   ├── BookmarkHandler.ts # 북마크 IPC
│   ├── WindowHandler.ts   # 윈도우 IPC
│   └── index.ts
│
├── utils/                 # 헬퍼 함수
│   ├── StaticFileServer.ts
│   ├── PathResolver.ts
│   └── index.ts
│
├── __tests__/             # 테스트
│
└── index.ts               # 메인 진입점
```

### 🎯 Main Process 계층 설명

#### 1️⃣ Core 레이어 - 시스템 관리

**AppLifecycle** (Electron 앱 생명주기)
```typescript
class AppLifecycle {
  // 책임: Electron 이벤트 처리
  - app.ready     → 앱 준비됨
  - app.quit      → 앱 종료
  - app.activate  → macOS dock 클릭
  - window-closed → 마지막 윈도우 닫혀짐
}
```

**WindowManager** (브라우저 윈도우)
```typescript
class WindowManager {
  // 책임: BrowserWindow 생성/관리
  - createWindow()        → 윈도우 생성
  - closeWindow(id)       → 윈도우 종료
  - focusWindow(id)       → 윈도우 활성화
  - getAllWindows()       → 모든 윈도우 조회
}
```

**EventBus** (이벤트 시스템)
```typescript
class EventBus {
  // 책임: 프로세스 내 이벤트 발행/구독
  - emit(event, data)     → 이벤트 발행
  - on(event, handler)    → 이벤트 구독
  - off(event, handler)   → 구독 취소
}
```

#### 2️⃣ Managers 레이어 - 상태 저장소

**TabManager** (탭 상태)
```typescript
class TabManager {
  // 책임: 탭 상태를 메모리에 저장
  - addTab(url, title)         → 탭 추가
  - removeTab(id)              → 탭 제거
  - getTab(id)                 → 탭 조회
  - getAllTabs()               → 모든 탭
  - updateTab(id, updates)     → 탭 업데이트
}

// 데이터 형태
interface BrowserTab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}
```

**HistoryManager** (히스토리 상태)
```typescript
class HistoryManager {
  // 책임: 방문 기록을 메모리에 저장
  - addEntry(url, title)       → 항목 추가
  - removeEntry(id)            → 항목 제거
  - getAll()                   → 전체 조회
  - search(query)              → 검색
  - clear()                    → 초기화
}
```

**ResourceManager** (리소스 모니터링)
```typescript
class ResourceManager {
  // 책임: 메모리, CPU 모니터링
  - canAllocate(sizeInMB)      → 메모리 충분한지 확인
  - getMemoryUsage()           → 메모리 사용량
  - getCpuUsage()              → CPU 사용량
  - startMonitoring()          → 모니터링 시작
  - stopMonitoring()           → 모니터링 중지
}
```

**ConfigManager** (설정)
```typescript
class ConfigManager {
  // 책임: 앱 설정 저장/로드
  - initialize()               → 초기화
  - getAll()                   → 전체 설정
  - get(key)                   → 특정 설정
  - set(key, value)            → 설정 변경
  - save()                     → 저장
  - load()                     → 로드
}
```

#### 3️⃣ Services 레이어 - 비즈니스 로직

**TabService** (탭 로직)
```typescript
class TabService {
  // 책임: 탭 관련 비즈니스 로직
  - createTab(url, title)      → 탭 생성
  - closeTab(id)               → 탭 종료
  - selectTab(id)              → 탭 선택
  - updateTab(id, updates)     → 탭 정보 수정
  - duplicateTab(id)           → 탭 복제
  - getAllTabs()               → 모든 탭 조회
  
  // 검증, 제약 처리 등
  - 메모리 체크
  - 최대 탭 수 체크
  - 유효한 URL 검증
}
```

**HistoryService** (히스토리 로직)
```typescript
class HistoryService {
  // 책임: 히스토리 비즈니스 로직
  - addEntry(tab)              → 방문 기록 추가
  - search(query)              → 검색
  - delete(id)                 → 기록 삭제
  - clear()                    → 모든 기록 삭제
  - getAll(limit)              → 조회
  
  // 검증, 제약 처리
  - 최대 히스토리 수 체크
  - 중복 제거
}
```

#### 4️⃣ Handlers 레이어 - IPC 라우터

**TabHandler** (탭 IPC)
```typescript
class TabHandler {
  // 책임: IPC 요청을 TabService로 라우팅
  
  // Renderer에서 요청
  ipcRenderer.invoke('tab:createNew', { url, title })
  
  // Main에서 처리
  ipcMain.handle('tab:createNew', (event, args) => {
    return this.tabService.createTab(args.url, args.title);
  })
  
  // 응답 전송
  return IpcResponseHelper.success(tab);
}
```

---

## 🔄 데이터 흐름 (E2E)

### 시나리오: 새 탭 생성

```
┌─────────────────────────────────────────────────────────────┐
│ 1️⃣ Renderer Process (UI)                                   │
│                                                             │
│  User clicks "New Tab" button                              │
│  ↓                                                          │
│  React Component calls:                                     │
│  window.electronAPI.invoke('tab:createNew', {              │
│    url: 'https://example.com',                             │
│    title: 'Example'                                        │
│  })                                                         │
└──────────────────────────┬──────────────────────────────────┘
                           │ IPC Message
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2️⃣ Main Process (Backend)                                  │
│                                                             │
│ TabHandler.handleCreateTab()                               │
│ ├─ Receives IPC request                                    │
│ ├─ Calls → TabService.createTab()                          │
│ │          ├─ Validates URL                                │
│ │          ├─ Checks memory (ResourceManager)              │
│ │          ├─ Checks max tabs (TabManager)                 │
│ │          └─ Calls → TabManager.addTab()                  │
│ │             ├─ Generates unique ID                       │
│ │             ├─ Creates BrowserTab object                 │
│ │             ├─ Stores in Map<id, tab>                    │
│ │             └─ Returns tab                               │
│ │                                                          │
│ ├─ Emits event: 'tab:created'                              │
│ └─ Returns success response:                               │
│    {                                                        │
│      success: true,                                        │
│      data: { id, url, title, ... }                         │
│    }                                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ IPC Response
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3️⃣ Renderer Process (UI)                                   │
│                                                             │
│ const response = await invoke(...)                          │
│ if (response.success) {                                    │
│   console.log('Tab created:', response.data);              │
│   updateUI(response.data);                                 │
│ } else {                                                   │
│   showError(response.error);                               │
│ }                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 계층별 책임 정리 (SRP)

| 계층 | 파일 | 책임 | 의존성 |
|------|------|------|--------|
| **Core** | AppLifecycle | Electron 앱 이벤트 처리 | - |
| **Core** | WindowManager | BrowserWindow 생성/관리 | - |
| **Core** | EventBus | 이벤트 발행/구독 | - |
| **Manager** | TabManager | 탭 상태 저장 | - |
| **Manager** | HistoryManager | 히스토리 상태 저장 | - |
| **Manager** | ResourceManager | 리소스 모니터링 | - |
| **Manager** | ConfigManager | 설정 저장/로드 | - |
| **Service** | TabService | 탭 로직 | TabManager, ResourceManager |
| **Service** | HistoryService | 히스토리 로직 | HistoryManager |
| **Service** | BookmarkService | 북마크 로직 | - |
| **Handler** | TabHandler | 탭 IPC 라우팅 | TabService |
| **Handler** | HistoryHandler | 히스토리 IPC 라우팅 | HistoryService |
| **Shared** | IPC | 프로세스 간 통신 | - |
| **Shared** | Logger | 로깅 | - |
| **Shared** | Errors | 에러 클래스 | - |

---

## 🔌 의존성 주입 (DI) 흐름

### main/index.ts에서의 초기화

```typescript
// 1️⃣ Core 생성
const windowManager = new WindowManager(config);
const appLifecycle = new AppLifecycle(windowManager);

// 2️⃣ Managers 생성 (의존성 없음)
const tabManager = new TabManager();
const historyManager = new HistoryManager();
const resourceManager = new ResourceManager();

// 3️⃣ Services 생성 (Managers 주입)
const tabService = new TabService(tabManager, resourceManager);
const historyService = new HistoryService(historyManager);

// 4️⃣ Handlers 생성 (Services 주입)
const tabHandler = new TabHandler(tabService);
const historyHandler = new HistoryHandler(historyService);

// 5️⃣ IPC 등록
tabHandler.registerHandlers();
historyHandler.registerHandlers();
```

### 의존성 그래프

```
              ┌─ WindowManager
              │
AppLifecycle ─┤  EventBus
              │
              └─ ConfigManager

              ┌─ TabManager ─┐
TabService ──┤              └─ HistoryManager
              │
              └─ ResourceManager

TabHandler ── TabService
HistoryHandler ── HistoryService
```

---

## ✅ 설계 원칙

### 1️⃣ SRP (Single Responsibility Principle)

각 클래스는 **하나의 책임**만 가집니다:
- **TabManager** → 탭 상태 저장소
- **TabService** → 탭 비즈니스 로직
- **TabHandler** → 탭 IPC 라우팅

### 2️⃣ DI (Dependency Injection)

의존성을 **생성자로 주입**합니다:
```typescript
class TabService {
  constructor(
    private tabManager: TabManager,
    private resourceManager: ResourceManager
  ) {}
}
```

### 3️⃣ 타입 안전성

- 공유 타입은 `@shared/types`에서 정의
- IPC 응답은 `IpcResponse<T>` 유니온 타입
- 에러는 `BaseError` 클래스 상속

### 4️⃣ 에러 처리

```typescript
// Shared에서 에러 정의
throw new ValidationError('Invalid input');

// Main에서 처리
try {
  await service.operation();
} catch (error) {
  return handleIpcError(error);
}

// Renderer에서 수신
if (response.success) {
  // 성공
} else {
  // 실패: response.error, response.code
}
```

---

## 🎯 정리

### Shared 레이어의 역할
✅ 모든 계층이 공유하는 타입, 상수, 에러, 유틸리티 제공
✅ IPC 채널 정의 및 타입 안전성 보장
✅ 로깅 및 보안 정책 제공

### Main Process의 역할
✅ **Core**: Electron 앱 생명주기 및 윈도우 관리
✅ **Managers**: 상태를 메모리에 저장
✅ **Services**: 비즈니스 로직 (검증, 제약 처리)
✅ **Handlers**: IPC 요청을 서비스로 라우팅

### 데이터 흐름
```
Renderer (UI) 
  ↓ IPC 요청
Handler (라우터)
  ↓ 요청 전달
Service (비즈니스 로직)
  ↓ 상태 변경
Manager (상태 저장소)
  ↓ 결과 반환
Renderer (UI 업데이트)
```

이 구조는 **명확한 책임 분리**, **테스트 용이성**, **유지보수성**을 제공합니다.
