# 📐 아키텍처 시각화 및 다이어그램

## 1️⃣ 전체 시스템 아키텍처

```
┌────────────────────────────────────────────────────────────────┐
│                      ASIDE BROWSER APP                          │
└────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PRELOAD SCRIPT                           │
│  (Renderer ↔ Main 브릿지)                                   │
│                                                             │
│  contextBridge.exposeInMainWorld('electronAPI', {           │
│    invoke(),  on(),  off(),  once()                         │
│    getEnvironment(),  getAppVersion(),  log()               │
│  })                                                         │
└────────────┬──────────────────────────────────────────────┬─┘
             │                                              │
             │ contextIsolation enabled                    │
             │ (안전한 IPC)                                │
             │                                              │
┌────────────▼──────────────┐                  ┌────────────▼──┐
│   RENDERER PROCESS        │                  │  MAIN PROCESS │
│   (UI 계층)               │                  │  (업무 계층)  │
│                           │                  │               │
│ ┌───────────────────────┐ │ IPC             │ ┌─────────────┐│
│ │  React Components     │─┼─────────────────┼─┤  Handlers   ││
│ │  - TabBar             │ │ invoke/on/off   │ │  - TabH.    ││
│ │  - HistoryPanel       │ │ (Type-safe)     │ │  - HistoryH.││
│ │  - BookmarkBar        │ │                 │ │  - BookmarkH││
│ │  - BrowserWindow      │ │                 │ │  - WindowH. ││
│ └───────────────────────┘ │                 │ └────────┬────┘│
│                           │                 │          │     │
│ ┌───────────────────────┐ │                 │ ┌────────▼────┐│
│ │  State Management     │ │                 │ │  Services   ││
│ │  - Tab Store          │ │                 │ │  - TabS.    ││
│ │  - History Store      │ │                 │ │  - HistoryS.││
│ │  - Settings Store     │ │                 │ │  - BookmarkS││
│ └───────────────────────┘ │                 │ │  - WindowS. ││
│                           │                 │ └────────┬────┘│
│ ┌───────────────────────┐ │                 │          │     │
│ │  Hooks & Utils        │ │                 │ ┌────────▼────┐│
│ │  - useIpc             │ │                 │ │  Managers   ││
│ │  - useTabs            │ │                 │ │  - TabMgr   ││
│ │  - useSettings        │ │                 │ │  - HistoryMg││
│ └───────────────────────┘ │                 │ │  - ResourceM││
│                           │                 │ │  - ConfigMgr││
│                           │                 │ └────────┬────┘│
│                           │                 │          │     │
│                           │                 │ ┌────────▼────┐│
│                           │                 │ │  Core       ││
│                           │                 │ │  - AppLC    ││
│                           │                 │ │  - WindowMgr││
│                           │                 │ │  - EventBus ││
│                           │                 │ └─────────────┘│
└───────────────────────────┘                 └─────────────────┘
             │                                         │
             └─────────────────────────────────────────┘
                         (Electron)

                  ┌──────────────────┐
                  │  SHARED LAYER    │
                  │                  │
                  │ - Types/Errors   │
                  │ - IPC Channels   │
                  │ - Logger         │
                  │ - Constants      │
                  │ - Utilities      │
                  └──────────────────┘
```

---

## 2️⃣ Main Process 계층 다이어그램

```
┌────────────────────────────────────────────────────┐
│  src/main/index.ts (진입점)                        │
│                                                    │
│  1. initializeDependencies()                       │
│  2. initializeServicesAndHandlers()                │
│  3. setupGlobalErrorHandlers()                     │
│  4. appInitializationFlow()                        │
└──────────────┬─────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────┐  │
│ │ HANDLERS (라우터)                            │  │
│ │ - TabHandler.registerHandlers()              │  │
│ │ - HistoryHandler.registerHandlers()          │  │
│ │ - BookmarkHandler.registerHandlers()         │  │
│ │ - WindowHandler.registerHandlers()           │  │
│ │                                              │  │
│ │ 책임: IPC 요청 수신 → 서비스로 라우팅       │  │
│ │ 의존성: Services                             │  │
│ └──────┬──────────────────────────────────────┘  │
│        │                                          │
│        ▼                                          │
│ ┌──────────────────────────────────────────────┐  │
│ │ SERVICES (비즈니스 로직)                     │  │
│ │ - TabService                                  │  │
│ │ - HistoryService                              │  │
│ │ - BookmarkService                             │  │
│ │ - WindowService                               │  │
│ │                                              │  │
│ │ 책임:                                        │  │
│ │ • 검증 (유효성 확인)                          │  │
│ │ • 제약 처리 (최대값 체크)                      │  │
│ │ • 로직 실행                                   │  │
│ │                                              │  │
│ │ 의존성: Managers                              │  │
│ └──────┬──────────────────────────────────────┘  │
│        │                                          │
│        ▼                                          │
│ ┌──────────────────────────────────────────────┐  │
│ │ MANAGERS (상태 저장소)                       │  │
│ │ - TabManager      (Map<id, BrowserTab>)      │  │
│ │ - HistoryManager  (Array<HistoryEntry>)      │  │
│ │ - ResourceManager (Memory/CPU info)          │  │
│ │ - ConfigManager   (Settings/Config)          │  │
│ │                                              │  │
│ │ 책임: 상태를 메모리에 저장/조회              │  │
│ │ 의존성: 없음                                  │  │
│ └──────┬──────────────────────────────────────┘  │
│        │                                          │
│        ▼                                          │
│ ┌──────────────────────────────────────────────┐  │
│ │ CORE (시스템 관리)                           │  │
│ │ - AppLifecycle (Electron 이벤트)             │  │
│ │ - WindowManager (BrowserWindow)              │  │
│ │ - EventBus (이벤트 발행/구독)                │  │
│ │                                              │  │
│ │ 책임: 앱 초기화 및 시스템 관리               │  │
│ │ 의존성: 없음 (최상위)                         │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## 3️⃣ IPC 통신 흐름 다이어그램

```
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1: Renderer에서 요청 발송                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  // React Component                                             │
│  const handleCreateTab = async () => {                          │
│    const response = await window.electronAPI.invoke(            │
│      'tab:createNew',                                           │
│      { url: 'https://example.com', title: 'Example' }          │
│    );                                                           │
│  };                                                             │
└─────────────────────────┬──────────────────────────────────────┘
                          │ IPC message
                          │ ═════════════════════════════
                          │ channel: 'tab:createNew'
                          │ args: { url, title }
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2: Main Process Handler에서 요청 수신                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  class TabHandler {                                             │
│    registerHandlers() {                                         │
│      ipcMain.handle('tab:createNew', async (event, args) => {  │
│        return this.handleCreateTab(args);                       │
│      });                                                        │
│    }                                                            │
│                                                                  │
│    private async handleCreateTab(args) {                        │
│      try {                                                      │
│        // STEP 3로 이동                                          │
│        const tab = await this.tabService.createTab(            │
│          args.url,                                             │
│          args.title                                            │
│        );                                                       │
│        return IpcResponseHelper.success(tab);                   │
│      } catch (error) {                                          │
│        return handleIpcError(error);                            │
│      }                                                          │
│    }                                                            │
│  }                                                              │
│                                                                  │
└─────────────────────────┬──────────────────────────────────────┘
                          │ 서비스 호출
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 3: Service에서 비즈니스 로직 실행                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  class TabService {                                             │
│    async createTab(url, title) {                                │
│      // ✓ 검증                                                   │
│      if (!this.isValidUrl(url)) {                               │
│        throw new ValidationError('Invalid URL');                │
│      }                                                          │
│                                                                  │
│      // ✓ 제약 확인                                              │
│      const tabs = this.tabManager.getAllTabs();                 │
│      if (tabs.length >= MAX_TABS) {                             │
│        throw new Error(`Max ${MAX_TABS} tabs reached`);         │
│      }                                                          │
│                                                                  │
│      // ✓ 리소스 확인                                            │
│      if (!this.resourceManager.canAllocate(40)) {               │
│        throw new Error('Insufficient memory');                  │
│      }                                                          │
│                                                                  │
│      // STEP 4로 이동                                            │
│      return this.tabManager.addTab(url, title);                 │
│    }                                                            │
│  }                                                              │
│                                                                  │
└─────────────────────────┬──────────────────────────────────────┘
                          │ 상태 저장 요청
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 4: Manager에서 상태 저장                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  class TabManager {                                             │
│    private tabs: Map<string, BrowserTab> = new Map();          │
│                                                                  │
│    addTab(url, title) {                                         │
│      const id = this.generateTabId();  // 'tab-xxx-yyy'         │
│                                                                  │
│      const tab: BrowserTab = {                                  │
│        id,                                                      │
│        url,                                                     │
│        title,                                                   │
│        isActive: false,                                         │
│        createdAt: Date.now(),                                   │
│        updatedAt: Date.now()                                    │
│      };                                                         │
│                                                                  │
│      this.tabs.set(id, tab);  // ✓ 메모리에 저장                 │
│      return tab;                                                │
│    }                                                            │
│  }                                                              │
│                                                                  │
└─────────────────────────┬──────────────────────────────────────┘
                          │ 응답 생성
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 5: Handler에서 응답 생성 및 전송                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  // 성공 응답                                                    │
│  return {                                                        │
│    success: true,                                               │
│    data: {                                                      │
│      id: 'tab-xxx-yyy',                                         │
│      url: 'https://example.com',                                │
│      title: 'Example',                                          │
│      isActive: false,                                           │
│      createdAt: 1234567890,                                     │
│      updatedAt: 1234567890                                      │
│    }                                                            │
│  };                                                             │
│                                                                  │
│  // 또는 에러 응답                                               │
│  return {                                                        │
│    success: false,                                              │
│    error: 'Invalid URL',                                        │
│    code: 'E_VALIDATION_ERROR'                                   │
│  };                                                             │
│                                                                  │
└─────────────────────────┬──────────────────────────────────────┘
                          │ IPC response
                          │ ═════════════════════════════
                          │ JSON serializable
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 6: Renderer에서 응답 처리                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  const response = await window.electronAPI.invoke(              │
│    'tab:createNew',                                             │
│    { url, title }                                               │
│  );                                                             │
│                                                                  │
│  if (response.success) {                                        │
│    // ✓ 성공: response.data 사용                                  │
│    console.log('Tab created:', response.data);                  │
│    setTabs(prev => [...prev, response.data]);  // UI 업데이트   │
│  } else {                                                       │
│    // ✗ 에러: response.error 사용                                │
│    console.error('Error:', response.error, response.code);      │
│    showErrorMessage(response.error);  // 에러 메시지 표시       │
│  }                                                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4️⃣ 타입 안전성 흐름

```
┌─────────────────────────────────────────────────────────────┐
│ Shared Layer (src/shared/)                                  │
│                                                             │
│ // types/domain.ts                                          │
│ export interface BrowserTab {                               │
│   id: string;                                               │
│   url: string;                                              │
│   title: string;                                            │
│   isActive: boolean;                                        │
│   createdAt: number;                                        │
│   updatedAt: number;                                        │
│ }                                                           │
│                                                             │
│ // ipc/types.ts                                             │
│ export interface IpcResponseSuccess<T> {                    │
│   success: true;                                            │
│   data: T;                                                  │
│ }                                                           │
│                                                             │
│ export interface IpcResponseError {                         │
│   success: false;                                           │
│   error: string;                                            │
│   code: string;                                             │
│ }                                                           │
│                                                             │
│ export type IpcResponse<T> =                                │
│   | IpcResponseSuccess<T>                                   │
│   | IpcResponseError;                                       │
│                                                             │
└────────────────────────────┬────────────────────────────────┘
                             │ Export
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Main Process (src/main/)                                    │
│                                                             │
│ import type { BrowserTab, IpcResponse } from '@shared';     │
│                                                             │
│ class TabService {                                          │
│   async createTab(url: string): Promise<BrowserTab> {       │
│     // ✓ 반환 타입이 명확함                                  │
│   }                                                         │
│ }                                                           │
│                                                             │
│ class TabHandler {                                          │
│   private async handleCreateTab(                            │
│     args                                                    │
│   ): Promise<IpcResponse<BrowserTab>> {                     │
│     // ✓ 응답 타입이 명확함                                  │
│     try {                                                   │
│       const tab = await this.tabService.createTab(...);     │
│       return {                                              │
│         success: true,                                      │
│         data: tab  // ✓ BrowserTab 타입 보장                 │
│       };                                                    │
│     } catch (error) {                                       │
│       return {                                              │
│         success: false,                                     │
│         error: 'Error message',                             │
│         code: 'E_CODE'                                      │
│       };                                                    │
│     }                                                       │
│   }                                                         │
│ }                                                           │
│                                                             │
└────────────────────────────┬────────────────────────────────┘
                             │ IPC
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Renderer Process (src/renderer/)                            │
│                                                             │
│ import type { BrowserTab, IpcResponse } from '@shared';     │
│                                                             │
│ async function createTab(url: string): Promise<void> {      │
│   const response: IpcResponse<BrowserTab> =                 │
│     await window.electronAPI.invoke('tab:createNew', {      │
│       url                                                   │
│     });                                                     │
│                                                             │
│   // ✓ 구분 가능한 유니온 타입                               │
│   if (response.success) {                                   │
│     // ✓ TypeScript가 자동으로 타입 좁혀짐                   │
│     const tab: BrowserTab = response.data;                  │
│     console.log(tab.url);  // ✓ 타입 안전                    │
│   } else {                                                  │
│     // ✓ error와 code만 접근 가능                            │
│     console.error(response.error, response.code);          │
│   }                                                         │
│ }                                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5️⃣ 메모리 상태 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│ TabManager (메모리 상태)                               │
│                                                        │
│ private tabs: Map<string, BrowserTab>                  │
│                                                        │
│ {                                                      │
│   'tab-001': {                                         │
│     id: 'tab-001',                                     │
│     url: 'https://google.com',                         │
│     title: 'Google',                                   │
│     isActive: true,                                    │
│     createdAt: 1696300000000,                          │
│     updatedAt: 1696300000000                           │
│   },                                                   │
│   'tab-002': {                                         │
│     id: 'tab-002',                                     │
│     url: 'https://github.com',                         │
│     title: 'GitHub',                                   │
│     isActive: false,                                   │
│     createdAt: 1696300010000,                          │
│     updatedAt: 1696300010000                           │
│   },                                                   │
│   'tab-003': {                                         │
│     id: 'tab-003',                                     │
│     url: 'https://example.com',                        │
│     title: 'Example',                                  │
│     isActive: false,                                   │
│     createdAt: 1696300020000,                          │
│     updatedAt: 1696300020000                           │
│   }                                                    │
│ }                                                      │
│                                                        │
│ activeTabId: 'tab-001'                                │
│                                                        │
│ 메모리 사용: 3 탭 × ~50KB = ~150KB                     │
│                                                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ HistoryManager (메모리 상태)                            │
│                                                        │
│ private entries: HistoryEntry[] = [                    │
│   {                                                    │
│     id: 'hist-001',                                    │
│     url: 'https://google.com',                         │
│     title: 'Google',                                   │
│     visitedAt: 1696300000000,                          │
│     count: 5                                           │
│   },                                                   │
│   {                                                    │
│     id: 'hist-002',                                    │
│     url: 'https://github.com',                         │
│     title: 'GitHub',                                   │
│     visitedAt: 1696300010000,                          │
│     count: 3                                           │
│   },                                                   │
│   // ... (최대 10,000개)                               │
│ ]                                                      │
│                                                        │
│ 메모리 사용: 10,000 항목 × ~30KB = ~300KB              │
│                                                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ResourceManager (리소스 모니터링)                       │
│                                                        │
│ 메모리 모니터링:                                        │
│ ├─ totalMemory: 16 GB                                  │
│ ├─ usedMemory: 4.5 GB (28%)                            │
│ └─ availableMemory: 11.5 GB                            │
│                                                        │
│ CPU 모니터링:                                           │
│ ├─ cores: 8                                            │
│ └─ avgLoad: 45%                                        │
│                                                        │
│ 앱 리소스:                                              │
│ ├─ tabsMemory: 150 KB                                  │
│ ├─ historyMemory: 300 KB                               │
│ └─ totalAppMemory: 500 KB                              │
│                                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 6️⃣ 에러 처리 흐름

```
┌──────────────────────────────────────────────┐
│ 에러 발생 (Main Process)                     │
└────────────┬─────────────────────────────────┘
             │
             ▼
    ┌────────────────────┐
    │ 에러 타입 확인      │
    └────────┬───────┬──┬─┘
             │       │  │
    ┌────────▼────┐  │  └────────────────────┐
    │ BaseError   │  │ ┌────────────────────┐│
    │ (예상됨)    │  │ │ Error              ││
    │             │  │ │ (예상됨)           ││
    └────────┬────┘  │ └────────┬───────────┘│
             │       │         │             │
             │       └─────────┼──────────────┼──┐
             │                 │             │  │
    ┌────────▼────────────┐    │   ┌─────────▼──▼─────────┐
    │ ValidationError     │    │   │ 예상치 못한 에러    │
    │ FileError           │    │   │ (RuntimeError 등)  │
    │ NetworkError        │    │   └─────────┬──────────┘
    │ DatabaseError       │    │             │
    └────────┬────────────┘    │    ┌────────▼──────────┐
             │                  │    │ E_UNKNOWN로 매핑   │
    ┌────────▼────────────────┐ │    └────────┬──────────┘
    │ handleIpcError() 호출     │ │             │
    │                          │ └─────────────┼─────────┐
    │ ├─ error.message 추출    │               │         │
    │ ├─ error.code 추출       │               │         │
    │ └─ IpcResponse 생성       │               │         │
    └────────┬────────────────┘                │         │
             │                                 │         │
             └─────────────────────┬───────────┘         │
                                   │                     │
                    ┌──────────────▼──────────────┐      │
                    │ IPC 응답 생성                │      │
                    │                             │      │
                    │ {                           │      │
                    │   success: false,           │      │
                    │   error: string,            │      │
                    │   code: string              │      │
                    │ }                           │      │
                    └──────────────┬──────────────┘      │
                                   │                     │
                    ┌──────────────▼──────────────┐      │
                    │ Renderer에 전송               │      │
                    └──────────────┬──────────────┘      │
                                   │                     │
                    ┌──────────────▼──────────────┐      │
                    │ Renderer에서 처리             │      │
                    │                             │      │
                    │ if (!response.success) {   │      │
                    │   showError(               │      │
                    │     response.error,        │      │
                    │     response.code          │      │
                    │   );                       │      │
                    │ }                           │      │
                    └─────────────────────────────┘      │
```

---

## 7️⃣ 시간 흐름 (타임라인)

```
Electron App Start
│
├─ 1. Logger 초기화 (0ms)
│  └─ LoggerImpl('Main', LogLevel.DEBUG)
│
├─ 2. ConfigManager 초기화 (10ms)
│  ├─ 설정 파일 로드
│  └─ 기본값 적용
│
├─ 3. WindowManager 생성 (20ms)
│  ├─ 윈도우 크기 설정
│  └─ 개발/프로덕션 환경 설정
│
├─ 4. AppLifecycle 생성 (30ms)
│  └─ 싱글 인스턴스 확인
│
├─ 5. Managers 생성 (50ms)
│  ├─ TabManager (Map 초기화)
│  ├─ HistoryManager (Array 초기화)
│  ├─ ResourceManager (모니터링 시작)
│  └─ ConfigManager (설정 로드)
│
├─ 6. Services 생성 (60ms)
│  ├─ TabService(tabManager, resourceManager)
│  ├─ HistoryService(historyManager)
│  ├─ BookmarkService()
│  └─ WindowService(windowManager)
│
├─ 7. Handlers 생성 및 등록 (70ms)
│  ├─ TabHandler.registerHandlers()
│  │  └─ ipcMain.handle('tab:*', ...)
│  ├─ HistoryHandler.registerHandlers()
│  ├─ BookmarkHandler.registerHandlers()
│  └─ WindowHandler.registerHandlers()
│
├─ 8. 전역 에러 핸들러 설정 (80ms)
│  ├─ process.on('uncaughtException')
│  └─ process.on('unhandledRejection')
│
├─ 9. AppLifecycle 초기화 (90ms)
│  ├─ Electron 이벤트 등록
│  └─ app.ready 대기
│
├─ 10. app:ready 이벤트 (100ms)
│  ├─ WindowManager.createWindow()
│  │  ├─ BrowserWindow 생성
│  │  ├─ preload.js 로드
│  │  └─ 렌더러 프로세스 시작
│  └─ appLifecycle.onAppReady()
│
├─ 11. EventBus 이벤트 발행 (110ms)
│  └─ EventBus.emit('app:initialized', { version: '1.0.0' })
│
└─ ✓ 앱 준비 완료 (120ms)
   ├─ IPC 핸들러 등록 완료
   ├─ 렌더러 프로세스 시작 완료
   └─ 사용자 상호작용 대기
```

이 다이어그램들은 아키텍처의 각 측면을 시각적으로 표현합니다. 🎨
