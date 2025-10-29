# 🎯 Shared & Main 구조 최종 요약

## 📊 한눈에 보는 구조

### 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process (UI)                    │
│                   React + TypeScript                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ IPC 통신
                           │ (Main ↔ Renderer)
┌──────────────────────────▼──────────────────────────────────┐
│                    Main Process (Backend)                   │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Handlers (IPC 라우터)                                    │ │
│ │ - TabHandler, HistoryHandler, BookmarkHandler           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                           ↓                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Services (비즈니스 로직)                                 │ │
│ │ - TabService, HistoryService, BookmarkService           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                           ↓                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Managers (상태 저장소)                                   │ │
│ │ - TabManager, HistoryManager, ResourceManager            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                           ↓                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Core (시스템 관리)                                       │ │
│ │ - AppLifecycle, WindowManager, EventBus                  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │    Shared (공유 자원)                 │
        │ - Types, Errors, IPC, Logger, Utils  │
        └──────────────────────────────────────┘
```

---

## 🎯 Shared 핵심 요소

### 1. Constants (상수)
```typescript
ERROR_CODES          // 에러 코드 정의
LIMITS               // 제약값 (탭 수, 메모리 등)
DEBOUNCE_MS          // 디바운스 시간
CACHE_DURATION_MS    // 캐시 유지시간
```

### 2. Errors (에러 클래스)
```typescript
BaseError            // 모든 에러의 기반
ValidationError      // 검증 실패
IpcChannelError      // IPC 채널 오류
FileError            // 파일 작업 오류
NetworkError         // 네트워크 오류
```

### 3. IPC (프로세스 간 통신)
```typescript
IPC_CHANNELS         // 채널 정의
IpcResponseHelper    // 응답 생성 헬퍼
handleIpcError       // 에러 처리 함수
wrapIpcHandler       // 핸들러 래퍼
```

### 4. Logger (로깅)
```typescript
LoggerImpl            // 로거 구현체
LogLevel             // 로그 레벨 (DEBUG, INFO, WARN, ERROR)
LogFieldsBuilder     // 로그 필드 빌더
```

### 5. Types (타입 정의)
```typescript
BrowserTab           // 탭 타입
HistoryEntry         // 히스토리 항목
Bookmark             // 북마크
AppSettings          // 앱 설정
```

---

## 🔧 Main Process 핵심 요소

### Core (시스템 관리)
| 클래스 | 책임 |
|--------|------|
| **AppLifecycle** | Electron 앱 이벤트 처리 (ready, quit, activate) |
| **WindowManager** | BrowserWindow 생성/관리 |
| **EventBus** | 프로세스 내 이벤트 발행/구독 |

### Managers (상태 저장소)
| 클래스 | 책임 | 데이터 |
|--------|------|--------|
| **TabManager** | 탭 상태 저장 | Map<id, BrowserTab> |
| **HistoryManager** | 히스토리 저장 | Array<HistoryEntry> |
| **ResourceManager** | 리소스 모니터링 | 메모리, CPU 정보 |
| **ConfigManager** | 설정 저장/로드 | JSON 설정 파일 |

### Services (비즈니스 로직)
| 클래스 | 책임 |
|--------|------|
| **TabService** | 탭 CRUD, 검증, 제약 처리 |
| **HistoryService** | 히스토리 관리, 검색 |
| **BookmarkService** | 북마크 관리 |
| **WindowService** | 윈도우 제어 |

### Handlers (IPC 라우터)
| 클래스 | 책임 |
|--------|------|
| **TabHandler** | 'tab:*' 채널 처리 |
| **HistoryHandler** | 'history:*' 채널 처리 |
| **BookmarkHandler** | 'bookmark:*' 채널 처리 |
| **WindowHandler** | 'window:*' 채널 처리 |

---

## 🔄 요청 처리 흐름

### 1단계: Renderer에서 요청 발송
```typescript
const response = await window.electronAPI.invoke('tab:createNew', {
  url: 'https://example.com',
  title: 'Example'
});
```

### 2단계: Handler에서 요청 수신
```typescript
ipcMain.handle('tab:createNew', async (event, args) => {
  // ✅ IPC 라우터: 서비스로 전달
  return this.tabService.createTab(args.url, args.title);
});
```

### 3단계: Service에서 비즈니스 로직 처리
```typescript
async createTab(url: string, title: string): Promise<BrowserTab> {
  // ✅ 검증
  if (!this.isValidUrl(url)) throw new ValidationError(...);
  
  // ✅ 제약 확인
  if (this.tabManager.getAllTabs().length >= MAX_TABS) throw new Error(...);
  
  // ✅ 리소스 확인
  if (!this.resourceManager.canAllocate(40)) throw new Error(...);
  
  // ✅ Manager에 저장
  return this.tabManager.addTab(url, title);
}
```

### 4단계: Manager에서 상태 저장
```typescript
addTab(url: string, title: string): BrowserTab {
  // ✅ 상태 저장소: 메모리에 저장
  const id = this.generateTabId();
  const tab: BrowserTab = { id, url, title, ... };
  this.tabs.set(id, tab);
  return tab;
}
```

### 5단계: Handler에서 응답 전송
```typescript
// ✅ 성공 응답
return IpcResponseHelper.success(tab);

// ❌ 에러 발생 시
try { ... } catch (error) {
  return handleIpcError(error);
}
```

### 6단계: Renderer에서 응답 처리
```typescript
if (response.success) {
  // ✅ 성공
  console.log('Tab created:', response.data);
} else {
  // ❌ 에러
  console.error('Error:', response.error, response.code);
}
```

---

## 📋 의존성 관계

### 생성 순서
```
1. Core 초기화
   └─ WindowManager
   └─ AppLifecycle
   └─ EventBus

2. Managers 생성 (독립적)
   └─ TabManager
   └─ HistoryManager
   └─ ResourceManager
   └─ ConfigManager

3. Services 생성 (Managers 주입)
   └─ TabService(tabManager, resourceManager)
   └─ HistoryService(historyManager)
   └─ BookmarkService()
   └─ WindowService(windowManager)

4. Handlers 생성 (Services 주입)
   └─ TabHandler(tabService)
   └─ HistoryHandler(historyService)
   └─ BookmarkHandler(bookmarkService)
   └─ WindowHandler(windowService)

5. IPC 등록
   └─ handler.registerHandlers()
```

---

## ✅ 설계 원칙

### SRP (Single Responsibility Principle)
```
❌ 나쁜 예
class TabManager {
  // ❌ 상태 저장 + 비즈니스 로직 + IPC 처리
  createTab() { ... }
  validateUrl() { ... }
  registerHandler() { ... }
}

✅ 좋은 예
class TabManager {
  // ✅ 상태 저장만
  addTab() { ... }
}

class TabService {
  // ✅ 비즈니스 로직만
  createTab() { ... }
  validateUrl() { ... }
}

class TabHandler {
  // ✅ IPC 처리만
  registerHandler() { ... }
}
```

### DI (Dependency Injection)
```
❌ 나쁜 예
class TabService {
  private tabManager = new TabManager();  // 직접 생성
}

✅ 좋은 예
class TabService {
  constructor(private tabManager: TabManager) {}  // 주입받음
}
```

### 타입 안전성
```
❌ 나쁜 예
const response: any = await invoke(...);
const data = response.data;

✅ 좋은 예
const response: IpcResponse<BrowserTab> = await invoke(...);
if (response.success) {
  const data: BrowserTab = response.data;  // 타입 보장
}
```

---

## 🎓 학습 포인트

### 1. IPC 통신의 흐름 이해
- Renderer → Main: `ipcRenderer.invoke()`
- Main → Renderer: `ipcMain.handle()`
- 응답 타입: `IpcResponse<T>` (구분 가능한 유니온)

### 2. 계층 구조의 이해
- **Handler**: IPC 요청을 받아서 Service로 전달
- **Service**: 비즈니스 로직 실행 (검증, 제약)
- **Manager**: 상태를 메모리에 저장
- **Core**: Electron 앱 초기화/관리

### 3. 에러 처리 패턴
- Shared에서 에러 클래스 정의
- Main에서 try-catch로 에러 처리
- Renderer에서 응답 타입으로 에러 확인

### 4. 의존성 주입 (DI)
- 모든 의존성은 생성자로 주입
- new 키워드 최소화 (index.ts에서만)
- 테스트 시 Mock 객체 주입 가능

---

## 📊 파일 간 연결 지도

```
index.ts (진입점)
  ├─ initializeDependencies()
  │  ├─ ConfigManager 초기화
  │  ├─ WindowManager 생성
  │  ├─ AppLifecycle 생성
  │  └─ Managers 생성
  │
  ├─ initializeServicesAndHandlers()
  │  ├─ initializeAllServices()
  │  │  ├─ TabService(tabManager, resourceManager)
  │  │  ├─ HistoryService(historyManager)
  │  │  ├─ BookmarkService()
  │  │  └─ WindowService(windowManager)
  │  │
  │  └─ registerAllHandlers()
  │     ├─ TabHandler.registerHandlers()
  │     ├─ HistoryHandler.registerHandlers()
  │     ├─ BookmarkHandler.registerHandlers()
  │     └─ WindowHandler.registerHandlers()
  │
  ├─ setupGlobalErrorHandlers()
  │  ├─ process.on('uncaughtException')
  │  └─ process.on('unhandledRejection')
  │
  └─ appInitializationFlow()
     ├─ appLifecycle.initialize()
     └─ EventBus.emit('app:initialized')
```

---

## 🚀 다음 단계

### 현재 구현 상태
- ✅ Core: AppLifecycle, WindowManager, EventBus (완료)
- ✅ Managers: TabManager, HistoryManager, ResourceManager, ConfigManager (완료)
- ✅ Services: TabService, HistoryService, BookmarkService, WindowService (완료)
- ✅ Handlers: TabHandler, HistoryHandler, BookmarkHandler, WindowHandler (완료)
- ✅ Shared: 모든 타입, 에러, IPC, 로거 (완료)

### 추가 할 일
- [ ] Utils 폴더: StaticFileServer, CacheManager, PathResolver
- [ ] 각 모듈 테스트 작성 (80% 커버리지)
- [ ] Preload 스크립트와 IPC 타입 연결
- [ ] Renderer에서 실제 IPC 호출 테스트
- [ ] E2E 통합 테스트

---

## 📚 참고 문서

1. **SHARED-MAIN-FULL-ANALYSIS.md** - 전체 구조 상세 분석
2. **CODE-PATTERNS-GUIDE.md** - 코드 예시 및 패턴
3. **MAIN-PROCESS-IMPLEMENTATION-PLAN.md** - Main 구현 계획
4. **SHARED-LAYER-REFERENCE.md** - Shared 레이어 사용법
5. **MAIN-PROCESS-ARCHITECTURE-ANALYSIS.md** - Main 구축 상황 분석

---

## 🎯 핵심 요약

```
┌──────────────────────────────────────┐
│ 설계 철학                             │
├──────────────────────────────────────┤
│ ✅ SRP: 각 클래스는 하나의 책임     │
│ ✅ DI: 의존성 주입으로 유연성      │
│ ✅ 타입 안전성: TypeScript 활용    │
│ ✅ 에러 처리: 계층별 예외 관리     │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ 계층 구조                             │
├──────────────────────────────────────┤
│ Handler  (IPC 라우터)                │
│ ↓                                    │
│ Service  (비즈니스 로직)             │
│ ↓                                    │
│ Manager  (상태 저장소)               │
│ ↓                                    │
│ Core     (시스템 관리)               │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ 통신 흐름                             │
├──────────────────────────────────────┤
│ Renderer (UI)                        │
│ ↓ IPC 요청                           │
│ Handler (라우터)                     │
│ ↓ 서비스 호출                        │
│ Service (로직)                       │
│ ↓ 상태 저장                          │
│ Manager (저장소)                     │
│ ↓ 결과 반환                          │
│ Renderer (업데이트)                  │
└──────────────────────────────────────┘
```

이 구조는 **명확성**, **테스트 용이성**, **유지보수성**을 극대화합니다. 🎉
