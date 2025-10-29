# 🔧 Main Process 구현 계획

**상태**: 📋 아키텍처 설계 단계  
**목표**: SRP 원칙에 따른 Electron 메인 프로세스 구축  
**우선순위**: shared 완료 후 시작

---

## 📊 현재 구조 분석

### ✅ 이미 완성된 것 (shared 레이어)
```
src/shared/
├── constants/          ✅ 시스템 리미트 정의
├── errors/             ✅ 에러 클래스
├── ipc/                ✅ 채널 정의
├── logger/             ✅ 로깅 시스템 (성능 최적화 완료)
├── platform/           ✅ 플랫폼 감지
├── security/           ✅ CSP, 인증, CORS (업데이트 완료)
├── system/             ✅ 정책 + 강제자 (버그 수정 완료)
├── types/              ✅ 타입 정의
└── utils/              ✅ 유틸 함수 (테스트 120개)
   └── __tests__/       ✅ 완벽한 테스트 커버리지
```

### ⏳ 구현할 것 (main 프로세스)
```
src/main/
├── core/               📋 라이프사이클 & 윈도우 관리
├── services/           📋 비즈니스 로직 (탭, 히스토리, 북마크 등)
├── handlers/           📋 IPC 요청 처리기
├── managers/           📋 상태 & 리소스 관리
├── utils/              📋 정적 헬퍼 (서버, 캐시 등)
└── index.ts            📋 진입점
```

---

## 🏗️ Main Process 아키텍처

### 레이어 구조 (SRP 원칙)

```
┌─────────────────────────────────────────────┐
│        Renderer Process (UI)                │  React 컴포넌트
│  (IPC 요청 전송)                            │
└────────────────────┬────────────────────────┘
                     │ IPC
                     ↓
┌─────────────────────────────────────────────┐
│        Main Process (Backend)               │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ handlers/                           │   │ IPC 요청 라우팅
│  │ ├─ TabHandler                       │   │
│  │ ├─ HistoryHandler                   │   │
│  │ ├─ BookmarkHandler                  │   │
│  │ └─ WindowHandler                    │   │
│  └─────────────────────────────────────┘   │
│            ↓ 위임                           │
│  ┌─────────────────────────────────────┐   │
│  │ services/                           │   │ 비즈니스 로직
│  │ ├─ TabService                       │   │
│  │ ├─ HistoryService                   │   │
│  │ ├─ BookmarkService                  │   │
│  │ └─ BrowserService                   │   │
│  └─────────────────────────────────────┘   │
│            ↓ 사용                          │
│  ┌─────────────────────────────────────┐   │
│  │ managers/                           │   │ 상태 관리
│  │ ├─ TabManager (활성 탭 상태)        │   │
│  │ ├─ HistoryManager (방문 기록)       │   │
│  │ ├─ BookmarkManager (북마크)         │   │
│  │ └─ ResourceManager (리소스)         │   │
│  └─────────────────────────────────────┘   │
│            ↓ 의존                          │
│  ┌─────────────────────────────────────┐   │
│  │ core/                               │   │ 시스템 관리
│  │ ├─ AppLifecycle (앱 생명주기)       │   │
│  │ ├─ WindowManager (윈도우)           │   │
│  │ ├─ EventBus (이벤트 발행)           │   │
│  │ └─ ConfigManager (설정)             │   │
│  └─────────────────────────────────────┘   │
│            ↓ 사용                          │
│  ┌─────────────────────────────────────┐   │
│  │ shared/ (공유 계층)                 │   │
│  │ ├─ constants (시스템 리미트)         │   │
│  │ ├─ logger (로깅)                    │   │
│  │ ├─ ipc (채널)                       │   │
│  │ ├─ security (CSP, CORS)             │   │
│  │ └─ system (정책 & 강제자)           │   │
│  └─────────────────────────────────────┘   │
│            ↓                                │
│  ┌─────────────────────────────────────┐   │
│  │ utils/                              │   │ 헬퍼
│  │ ├─ StaticFileServer                 │   │
│  │ ├─ CacheManager                     │   │
│  │ └─ PathResolver                     │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## 📋 파일별 책임 (SRP)

### 1️⃣ `core/` - 시스템 관리

#### `AppLifecycle.ts` - 앱 생명주기 관리
```typescript
class AppLifecycle {
  // 책임: 앱 시작/종료/준비/활성화 처리
  
  private onAppReady()     // Electron ready 이벤트
  private onAppQuit()      // 앱 종료 처리
  private onAppActivate()  // macOS dock 클릭
  
  public async initialize()
  public async shutdown()
  public getAppState(): AppState
}
```

**책임 범위**:
- Electron 앱 이벤트 처리
- 초기화 순서 관리
- 리소스 정리

**책임 외**:
- ❌ 윈도우 생성 (WindowManager)
- ❌ IPC 처리 (handlers)
- ❌ 비즈니스 로직 (services)

---

#### `WindowManager.ts` - 윈도우 관리
```typescript
class WindowManager {
  // 책임: 브라우저 윈도우 생성/관리/소통
  
  public createWindow(): BrowserWindow
  public closeWindow(id: string): void
  public focusWindow(id: string): void
  public getAllWindows(): BrowserWindow[]
  
  private setupWindowEvents(window: BrowserWindow)
}
```

**책임 범위**:
- BrowserWindow 생성/관리
- 윈도우 이벤트 처리
- preload 스크립트 로드

**책임 외**:
- ❌ 앱 시작 로직 (AppLifecycle)
- ❌ 윈도우 데이터 저장 (services)

---

#### `EventBus.ts` - 이벤트 발행/구독
```typescript
class EventBus extends EventEmitter {
  // 책임: 프로세스 내부 이벤트 통신
  
  public emit(event: string, data: any): void
  public on(event: string, listener: Function): void
  public off(event: string, listener: Function): void
}
```

**책임 범위**:
- 이벤트 발행/구독 패턴
- 느슨한 결합 유지

---

#### `ConfigManager.ts` - 설정 관리
```typescript
class ConfigManager {
  // 책임: 사용자 설정 로드/저장
  
  public loadConfig(): Config
  public saveConfig(config: Config): void
  public getConfig<T>(key: string): T
  public setConfig<T>(key: string, value: T): void
}
```

---

### 2️⃣ `services/` - 비즈니스 로직

#### `TabService.ts` - 탭 관리 서비스
```typescript
class TabService {
  // 책임: 탭 CRUD 및 상태 관리 로직
  
  public createTab(url: string): Tab
  public closeTab(tabId: string): void
  public updateTab(tabId: string, data: Partial<Tab>): void
  public getTab(tabId: string): Tab
  public getAllTabs(): Tab[]
  
  private validateTabCount(): void
  private enforceMemoryLimits(): void
}
```

**의존성**:
- ✅ TabManager (상태 저장소)
- ✅ shared/system/policies (탭 정책)
- ✅ shared/logger (로깅)

---

#### `HistoryService.ts` - 방문 기록 서비스
```typescript
class HistoryService {
  // 책임: 방문 기록 저장/조회/분석 로직
  
  public addToHistory(entry: HistoryEntry): void
  public getHistory(limit?: number): HistoryEntry[]
  public searchHistory(query: string): HistoryEntry[]
  public clearHistory(options?: ClearOptions): void
  public getFrequentSites(): Site[]
}
```

---

#### `BookmarkService.ts` - 북마크 서비스
```typescript
class BookmarkService {
  // 책임: 북마크 CRUD 및 정렬 로직
  
  public addBookmark(url: string, title: string): Bookmark
  public removeBookmark(id: string): void
  public getAllBookmarks(): Bookmark[]
  public searchBookmarks(query: string): Bookmark[]
  public reorderBookmarks(ids: string[]): void
}
```

---

#### `BrowserService.ts` - 브라우저 전체 서비스
```typescript
class BrowserService {
  // 책임: 브라우저 전역 기능
  
  public navigate(url: string): void
  public goBack(): void
  public goForward(): void
  public reload(): void
  public setProxySettings(settings: ProxySettings): void
}
```

---

### 3️⃣ `handlers/` - IPC 핸들러 (라우터)

#### `TabHandler.ts` - 탭 IPC 핸들러
```typescript
class TabHandler {
  // 책임: IPC 요청을 service로 라우팅
  
  constructor(private tabService: TabService) {}
  
  public async handleCreateTab(event: IpcMainInvokeEvent, req: CreateTabRequest) {
    return this.tabService.createTab(req.url);
  }
  
  public async handleCloseTab(event, tabId: string) {
    return this.tabService.closeTab(tabId);
  }
  
  // IPC 채널 등록
  public registerHandlers() {
    ipcMain.handle(IPC_CHANNELS.tab.create, (e, req) => this.handleCreateTab(e, req));
    ipcMain.handle(IPC_CHANNELS.tab.close, (e, id) => this.handleCloseTab(e, id));
  }
}
```

**책임 범위**:
- IPC 핸들 등록/처리
- 요청 검증
- 응답 포맷팅

**책임 외**:
- ❌ 비즈니스 로직 (service)
- ❌ 상태 관리 (manager)

---

### 4️⃣ `managers/` - 상태 관리

#### `TabManager.ts` - 탭 상태 저장소
```typescript
class TabManager {
  // 책임: 활성 탭 상태 저장/조회
  
  private tabs: Map<string, Tab> = new Map()
  
  public add(tab: Tab): void
  public remove(tabId: string): void
  public get(tabId: string): Tab | undefined
  public getAll(): Tab[]
  public update(tabId: string, data: Partial<Tab>): void
  
  public getTotalMemoryUsage(): number
  public getTabCount(): number
}
```

**책임 범위**:
- 인메모리 상태 저장
- CRUD 작업

**책임 외**:
- ❌ 비즈니스 로직 (service)
- ❌ 데이터 영속성 (DB)

---

#### `ResourceManager.ts` - 리소스 관리
```typescript
class ResourceManager {
  // 책임: 시스템 리소스 모니터링
  
  public getMemoryUsage(): MemoryUsage
  public getCpuUsage(): CpuUsage
  public getNetworkUsage(): NetworkUsage
  
  public enforceMemoryLimits(): void
  public optimizeResources(): void
}
```

---

### 5️⃣ `utils/` - 헬퍼

#### `StaticFileServer.ts` - 정적 파일 서버
```typescript
class StaticFileServer {
  // 책임: 리소스 파일 제공
  
  private baseDir: string
  
  public serve(filePath: string): Promise<Buffer>
  public getMimeType(filePath: string): string
}
```

---

#### `CacheManager.ts` - 캐싱 유틸
```typescript
class CacheManager {
  // 책임: 간단한 캐싱 기능
  
  private cache: Map<string, CacheEntry>
  
  public set<T>(key: string, value: T, ttl?: number): void
  public get<T>(key: string): T | undefined
  public clear(): void
}
```

---

## 🚀 구현 순서 (Phase)

### Phase 1: 기초 (1-2일)
```
목표: 앱 시작/종료 가능하게 하기

1. ✅ core/AppLifecycle.ts
   - Electron 라이프사이클 처리
   - Logger 초기화
   
2. ✅ core/WindowManager.ts
   - 윈도우 생성/관리
   - preload 로드
   
3. ✅ core/EventBus.ts
   - 이벤트 발행/구독
   
4. 📋 index.ts (진입점)
   - AppLifecycle 시작
   - WindowManager 생성
```

**테스트 목표**: 앱 실행 → 윈도우 표시 → 앱 종료

---

### Phase 2: 상태 관리 (1-2일)
```
목표: 탭 생성/관리 가능하게 하기

1. 📋 managers/TabManager.ts
   - 탭 상태 저장
   
2. 📋 managers/ResourceManager.ts
   - 리소스 모니터링
   
3. 📋 services/TabService.ts
   - 탭 CRUD 로직
   - 메모리 제한 적용
```

**테스트 목표**: 탭 5개 생성 → 메모리 모니터링

---

### Phase 3: IPC 통신 (1-2일)
```
목표: Renderer에서 탭 생성/종료 가능하게 하기

1. 📋 handlers/TabHandler.ts
   - IPC 채널 등록
   - 요청 라우팅
   
2. 📋 handlers/HistoryHandler.ts
3. 📋 handlers/BookmarkHandler.ts
4. 📋 handlers/WindowHandler.ts
```

**테스트 목표**: IPC 요청 → Service 처리 → 응답 반환

---

### Phase 4: 비즈니스 로직 (2-3일)
```
목표: 완전한 기능 구현

1. 📋 services/HistoryService.ts
2. 📋 services/BookmarkService.ts
3. 📋 services/BrowserService.ts
4. 📋 utils/StaticFileServer.ts
5. 📋 utils/CacheManager.ts
```

---

### Phase 5: 통합 테스트 (1-2일)
```
모든 레이어 통합 검증
E2E 테스트
성능 프로파일링
```

---

## 📝 첫 구현 파일: core/AppLifecycle.ts

```typescript
/**
 * AppLifecycle
 * 
 * 책임: Electron 앱의 생명주기 관리
 * 
 * - app.ready: 앱 초기화
 * - app.before-quit: 리소스 정리
 * - app.activate (macOS): dock 클릭 처리
 * - app.window-all-closed: 마지막 윈도우 종료 처리
 */

import { app } from 'electron';
import { Logger } from '@shared/logger';
import { AppState } from '@shared/types';

export class AppLifecycle {
  private logger: Logger;
  private state: AppState = 'initializing';
  
  constructor(private windowManager: WindowManager) {
    this.logger = Logger.getInstance();
  }
  
  /**
   * 앱 초기화
   * - 필수 리소스 로드
   * - 윈도우 생성
   * - 이벤트 등록
   */
  public async initialize(): Promise<void> {
    this.logger.info('AppLifecycle: Initializing...');
    
    app.on('ready', () => this.onAppReady());
    app.on('before-quit', () => this.onAppQuit());
    app.on('activate', () => this.onAppActivate());
    app.on('window-all-closed', () => this.onWindowAllClosed());
    
    this.state = 'initialized';
  }
  
  private async onAppReady(): Promise<void> {
    this.logger.info('AppLifecycle: App ready');
    
    try {
      this.windowManager.createWindow();
      this.state = 'running';
    } catch (error) {
      this.logger.error('Failed to create window', { error });
      app.quit();
    }
  }
  
  private onAppQuit(): void {
    this.logger.info('AppLifecycle: App quitting');
    this.state = 'shutting_down';
    // 리소스 정리
  }
  
  private onAppActivate(): void {
    this.logger.info('AppLifecycle: App activated (macOS)');
    if (this.windowManager.getAllWindows().length === 0) {
      this.windowManager.createWindow();
    }
  }
  
  private onWindowAllClosed(): void {
    this.logger.info('AppLifecycle: All windows closed');
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }
  
  public getState(): AppState {
    return this.state;
  }
}
```

---

## ✅ 준비 체크리스트

- [x] **shared 레이어 완성** (250+ 테스트)
- [ ] **main 프로세스 아키텍처 설계** (이 문서)
- [ ] **Phase 1: 기초 구현** (core 폴더)
- [ ] **Phase 2: 상태 관리** (managers 폴더)
- [ ] **Phase 3: IPC 통신** (handlers 폴더)
- [ ] **Phase 4: 비즈니스 로직** (services 폴더)
- [ ] **Phase 5: 통합 테스트** (E2E)

---

## 🎯 다음 단계

**즉시 시작할 작업**:

1. ✅ 이 문서 검토
2. 📋 Phase 1 구현 시작
   - `src/main/core/AppLifecycle.ts`
   - `src/main/core/WindowManager.ts`
   - `src/main/core/EventBus.ts`
3. 📋 `src/main/index.ts` 작성 (진입점)

**예상 일정**: 5-7일 (각 phase 1-2일)

---

**수정 이력**:
- v1.0: 초기 계획 (SRP 원칙 기반)
