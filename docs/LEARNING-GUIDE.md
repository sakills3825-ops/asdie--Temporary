# 📚 학습 가이드 - Shared & Main 이해하기

이 가이드는 처음 프로젝트에 입문하는 개발자를 위한 완벽한 입문서입니다.

---

## 🎯 1단계: 전체 그림 이해하기 (5분)

### Electron 앱의 프로세스 구조

```
┌─────────────────────┐
│  Renderer Process   │
│  (UI - React)       │
└──────────┬──────────┘
           │ IPC
           ↓
┌─────────────────────┐
│  Main Process       │
│  (Backend)          │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Shared Layer       │
│  (공유 자원)         │
└─────────────────────┘
```

**핵심**:
- Renderer = 사용자 인터페이스 (React)
- Main = 백엔드 비즈니스 로직
- Shared = 둘이 공유하는 타입, 상수, 유틸리티

---

## 🎯 2단계: Shared 레이어 이해하기 (10분)

### Shared의 5가지 핵심 요소

#### 1️⃣ Constants (상수)
```typescript
import { ERROR_CODES, LIMITS } from '@shared';

ERROR_CODES.VALIDATION_ERROR      // 검증 실패 에러 코드
LIMITS.MAX_TABS                   // 최대 100개 탭
```
**역할**: 앱 전체에서 사용할 공통 상수

#### 2️⃣ Errors (에러 클래스)
```typescript
import { BaseError, ValidationError } from '@shared';

throw new ValidationError('Email is invalid');
```
**역할**: 일관된 에러 처리

#### 3️⃣ IPC (프로세스 간 통신)
```typescript
import { IPC_CHANNELS, IpcResponseHelper } from '@shared';

// Renderer
await window.electronAPI.invoke('tab:createNew', { url: '...' });

// Main
ipcMain.handle('tab:createNew', async (event, args) => {
  return IpcResponseHelper.success(data);
});
```
**역할**: Renderer ↔ Main 안전한 통신

#### 4️⃣ Logger (로깅)
```typescript
import { LoggerImpl, LogLevel } from '@shared';

const logger = new LoggerImpl('ModuleName', LogLevel.INFO);
logger.info('메시지', { metadata });
```
**역할**: 일관된 로깅

#### 5️⃣ Types (타입)
```typescript
import type { BrowserTab, HistoryEntry } from '@shared';

const tab: BrowserTab = {
  id: 'tab-123',
  url: 'https://example.com',
  title: 'Example'
};
```
**역할**: TypeScript 타입 안전성

---

## 🎯 3단계: Main Process 계층 이해하기 (15분)

### Main의 4개 계층 (Bottom-up)

#### 1️⃣ Core (시스템 관리) - 가장 아래
```typescript
// 책임: Electron 앱 초기화 및 윈도우 관리
class AppLifecycle {
  // app.ready, app.quit 등 Electron 이벤트 처리
}

class WindowManager {
  // BrowserWindow 생성/관리
}

class EventBus {
  // 프로세스 내 이벤트 발행/구독
}
```

#### 2️⃣ Managers (상태 저장소)
```typescript
// 책임: 상태를 메모리에 저장하기만 함
class TabManager {
  private tabs: Map<string, BrowserTab> = new Map();
  addTab(url, title) { /* 메모리에 저장 */ }
}

class HistoryManager {
  private entries: HistoryEntry[] = [];
  addEntry(url) { /* 메모리에 저장 */ }
}
```

**중요**: Manager는 **순수하게 상태 저장만** 담당합니다.

#### 3️⃣ Services (비즈니스 로직)
```typescript
// 책임: 검증, 제약 처리, 실제 로직 실행
class TabService {
  async createTab(url: string): Promise<BrowserTab> {
    // ✓ 검증
    if (!isValidUrl(url)) throw new ValidationError(...);
    
    // ✓ 제약
    if (tabs.length >= MAX_TABS) throw new Error(...);
    
    // ✓ 리소스
    if (!canAllocate(40)) throw new Error(...);
    
    // ✓ 실행
    return this.tabManager.addTab(url);
  }
}
```

**중요**: Service는 Manager를 호출하여 상태를 저장합니다.

#### 4️⃣ Handlers (IPC 라우터) - 가장 위
```typescript
// 책임: IPC 요청을 Service로 라우팅
class TabHandler {
  registerHandlers() {
    ipcMain.handle('tab:createNew', async (event, args) => {
      try {
        const tab = await this.tabService.createTab(args.url);
        return IpcResponseHelper.success(tab);
      } catch (error) {
        return handleIpcError(error);
      }
    });
  }
}
```

**중요**: Handler는 IPC 요청을 받아서 Service로 전달하기만 합니다.

---

## 🎯 4단계: 데이터 흐름 이해하기 (10분)

### 새 탭 생성 흐름

```
1️⃣ Renderer가 요청
   user clicks "New Tab"
   → window.electronAPI.invoke('tab:createNew', { url: '...' })

2️⃣ Handler가 수신
   ipcMain.handle('tab:createNew', ...) 
   → 서비스 호출

3️⃣ Service가 검증 & 실행
   - URL 검증
   - 메모리 확인
   - 최대 탭 수 확인
   → Manager 호출

4️⃣ Manager가 상태 저장
   - Map에 저장
   - 탭 객체 반환

5️⃣ Service가 결과 반환
   → 검증된 탭 객체 반환

6️⃣ Handler가 응답 생성
   → IpcResponseHelper.success(tab) 반환

7️⃣ Renderer가 수신 & UI 업데이트
   const response = await invoke(...)
   if (response.success) {
     updateUI(response.data);
   }
```

---

## 🎯 5단계: 아키텍처 원칙 이해하기 (10분)

### 원칙 1: SRP (Single Responsibility Principle)

**❌ 나쁜 예**
```typescript
class TabManager {
  // ❌ 너무 많은 책임
  addTab() { }          // 상태 저장
  validateUrl() { }      // 검증
  registerHandler() { }  // IPC
}
```

**✅ 좋은 예**
```typescript
class TabManager {
  // ✅ 상태 저장만
  addTab() { }
}

class TabService {
  // ✅ 검증과 로직만
  validateUrl() { }
  createTab() { }
}

class TabHandler {
  // ✅ IPC 라우팅만
  registerHandler() { }
}
```

### 원칙 2: DI (Dependency Injection)

**❌ 나쁜 예**
```typescript
class TabService {
  private tabManager = new TabManager();  // 직접 생성
}
```

**✅ 좋은 예**
```typescript
class TabService {
  constructor(private tabManager: TabManager) {}  // 주입받음
}

// 사용 시
const tabManager = new TabManager();
const tabService = new TabService(tabManager);
```

**이점**:
- 테스트 시 Mock 객체 주입 가능
- 의존성이 명확함
- 변경 영향도 최소화

### 원칙 3: 타입 안전성

**❌ 나쁜 예**
```typescript
const response: any = await invoke(...);
const data = response.data;  // data의 타입을 알 수 없음
```

**✅ 좋은 예**
```typescript
const response: IpcResponse<BrowserTab> = await invoke(...);

if (response.success) {
  // TypeScript가 자동으로 타입 확인
  const data: BrowserTab = response.data;
  console.log(data.id);  // ✓ 타입 안전
}
```

---

## 🎯 6단계: 실제 코드 읽기 (20분)

### main/index.ts 읽기

```typescript
// 1️⃣ 모든 의존성 초기화
async function initializeDependencies(): Promise<AppState> {
  // Core 생성
  const windowManager = new WindowManager(config);
  const appLifecycle = new AppLifecycle(windowManager);
  
  // Managers 생성 (서로 독립적)
  const tabManager = new TabManager();
  const historyManager = new HistoryManager();
  const resourceManager = new ResourceManager();
  
  return { windowManager, appLifecycle, tabManager, ... };
}

// 2️⃣ Services와 Handlers 초기화
function initializeServicesAndHandlers(state: AppState): void {
  // Services 생성 (Managers 주입)
  const services = initializeAllServices(
    state.tabManager,
    state.historyManager,
    ...
  );
  
  // Handlers 생성 (Services 주입) 및 등록
  registerAllHandlers(
    services.tabService,
    services.historyService,
    ...
  );
}

// 3️⃣ 메인 루프 시작
async function handleMainExecution(): Promise<void> {
  const state = await initializeDependencies();
  await appInitializationFlow(state);
}
```

### handlers/TabHandler.ts 읽기

```typescript
export class TabHandler {
  constructor(private tabService: ITabService) {}
  
  registerHandlers(): void {
    // ✓ 새 탭 생성
    ipcMain.handle(IPC_CHANNELS.tabCreateNew, 
      (_event, args) => this.handleCreateTab(args)
    );
  }
  
  private async handleCreateTab(args): Promise<IpcResponse> {
    try {
      // Service 호출
      const tab = await this.tabService.createTab(args.url);
      // 성공 응답
      return IpcResponseHelper.success(tab);
    } catch (error) {
      // 에러 응답
      return handleIpcError(error);
    }
  }
}
```

### services/TabService.ts 읽기

```typescript
export class TabService {
  async createTab(url: string): Promise<BrowserTab> {
    // ✓ 검증
    if (!this.isValidUrl(url)) {
      throw new ValidationError('Invalid URL');
    }
    
    // ✓ 제약 확인
    const allTabs = this.tabManager.getAllTabs();
    if (allTabs.length >= 100) {
      throw new Error('Max 100 tabs reached');
    }
    
    // ✓ 리소스 확인
    if (!this.resourceManager.canAllocate(40)) {
      throw new Error('Insufficient memory');
    }
    
    // ✓ Manager 호출
    return this.tabManager.addTab(url);
  }
}
```

### managers/TabManager.ts 읽기

```typescript
export class TabManager {
  private tabs: Map<string, BrowserTab> = new Map();
  
  addTab(url: string, title: string): BrowserTab {
    // ✓ 탭 ID 생성
    const id = `tab-${Date.now()}-${Math.random()}`;
    
    // ✓ 탭 객체 생성
    const tab: BrowserTab = {
      id,
      url,
      title,
      isActive: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // ✓ 메모리에 저장
    this.tabs.set(id, tab);
    
    // ✓ 반환
    return tab;
  }
}
```

---

## 🎯 7단계: 새 기능 추가해보기 (15분)

### 문제: 탭의 음소거 기능 추가하기

#### Step 1: Shared 레이어
```typescript
// src/shared/types/domain.ts 수정
export interface BrowserTab {
  // ... 기존 필드
  isMuted: boolean;  // ← 추가
}

// src/shared/ipc/channels.ts 수정
export const IPC_CHANNELS = {
  // ... 기존 채널
  tabMute: 'tab:mute',  // ← 추가
};
```

#### Step 2: Manager 계층
```typescript
// src/main/managers/TabManager.ts 수정
export class TabManager {
  muteTab(id: string): void {
    const tab = this.tabs.get(id);
    if (tab) {
      tab.isMuted = !tab.isMuted;
      tab.updatedAt = Date.now();
    }
  }
}
```

#### Step 3: Service 계층
```typescript
// src/main/services/TabService.ts 추가
export class TabService {
  async muteTab(id: string): Promise<BrowserTab> {
    // ✓ 탭 존재 여부 확인
    const tab = this.tabManager.getTab(id);
    if (!tab) {
      throw new NotFoundError(`Tab ${id} not found`);
    }
    
    // ✓ Manager 호출
    this.tabManager.muteTab(id);
    
    // ✓ 이벤트 발행
    EventBus.getInstance().emit('tab:muted', tab);
    
    // ✓ 수정된 탭 반환
    return this.tabManager.getTab(id)!;
  }
}
```

#### Step 4: Handler 계층
```typescript
// src/main/handlers/TabHandler.ts 수정
export class TabHandler {
  registerHandlers(): void {
    // ... 기존 핸들러
    
    ipcMain.handle(IPC_CHANNELS.tabMute, 
      (_event, tabId: string) => this.handleMuteTab(tabId)
    );
  }
  
  private async handleMuteTab(tabId: string): Promise<IpcResponse> {
    try {
      const tab = await this.tabService.muteTab(tabId);
      return IpcResponseHelper.success(tab);
    } catch (error) {
      return handleIpcError(error);
    }
  }
}
```

#### Step 5: Renderer에서 사용
```typescript
// src/renderer/components/TabItem.tsx
const handleMuteClick = async () => {
  const response = await window.electronAPI.invoke('tab:mute', tabId);
  if (response.success) {
    console.log('Tab muted:', response.data);
  } else {
    console.error('Error:', response.error);
  }
};
```

---

## 📚 관련 문서

| 문서 | 내용 | 대상 |
|------|------|------|
| SHARED-MAIN-FULL-ANALYSIS.md | 전체 구조 상세 분석 | 아키텍처 이해 |
| SHARED-MAIN-QUICK-SUMMARY.md | 빠른 요약 | 빠른 참고 |
| CODE-PATTERNS-GUIDE.md | 코드 예시 및 패턴 | 실제 구현 |
| ARCHITECTURE-DIAGRAMS.md | 시각화 다이어그램 | 시각적 이해 |
| STRUCTURE-VALIDATION-CHECKLIST.md | 구현 검증 | 완성도 확인 |

---

## 🎓 핵심 요점 정리

### 1. 계층 구조
```
Handler (IPC)
  ↓
Service (로직)
  ↓
Manager (상태)
  ↓
Core (시스템)
```

### 2. 의존성 방향
- **아래로만** 의존 (위에서 아래로)
- 순환 의존성 **절대 금지**

### 3. 각 계층의 책임
- **Handler**: IPC 요청 처리 (검증 X, 라우팅만)
- **Service**: 비즈니스 로직 (검증, 제약 O)
- **Manager**: 상태 저장 (비즈니스 로직 X)
- **Core**: 시스템 초기화

### 4. 에러 처리
- Shared에서 정의
- Service에서 throw
- Handler에서 catch & 응답

### 5. 로깅
- 각 계층에서 진입/종료 로깅
- 에러 발생 시 상세 로깅

---

## ✅ 이제 준비됨!

이제 다음을 할 수 있습니다:
- ✅ Shared 레이어 코드 읽기
- ✅ Main Process 구조 이해하기
- ✅ IPC 통신 흐름 파악하기
- ✅ 새 기능 추가하기
- ✅ 테스트 작성하기

**다음 단계**: CODE-PATTERNS-GUIDE.md에서 실제 코드 예시를 보며 학습하세요! 🚀
