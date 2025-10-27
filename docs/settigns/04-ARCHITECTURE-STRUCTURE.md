# 아키텍처 설계 및 디렉토리 구조

## 전체 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                   Zen Browser (Electron)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         UI Layer (React + Tailwind CSS)              │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │ Main Window (Zen-like Layout)                  │ │  │
│  │  │ ┌────────────┬────────────────────────────────┐│ │  │
│  │  │ │  SideBar   │  Main Content Area             ││ │  │
│  │  │ │  (Tabs)    │  ┌──────────────────────────┐││ │  │
│  │  │ │  ┌──────┐  │  │  URL Bar  ◀─ Hidden?   │││ │  │
│  │  │ │  │ Tab1 │  │  │  Web View               │││ │  │
│  │  │ │  │ Tab2 │  │  │  (BrowserView)          │││ │  │
│  │  │ │  │ Tab3 │  │  │  ┌────────────────────┐│││ │  │
│  │  │ │  └──────┘  │  │  │   Rendered HTML    │││  │  │
│  │  │ └────────────┴────────────────────────────┘│ │  │
│  │  │                                             │ │  │
│  │  │ Settings / ASCII Toggle                    │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ASCII Mode (Terminal-like Rendering)            │  │
│  │  - PixelJS / WebGL 기반 ASCII 렌더링            │  │
│  │  - 동일한 기능, 다른 UI                          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
          ▲                    ▲                    ▲
          │                    │                    │
     IPC Channel            Store                 Events
```

## 디렉토리 구조

### 최상위 구조
```
zen-browser/
├── .github/
│   ├── instructions/
│   │   └── codacy.instructions.md
│   └── workflows/
│       ├── ci.yml
│       └── build.yml
│
├── packages/
│   ├── main/            # Main Process (Electron)
│   ├── renderer/        # Renderer Process (React)
│   ├── preload/         # Preload Scripts
│   └── shared/          # 공유 타입 및 유틸
│
├── docs/                # 이 문서들
├── pnpm-workspace.yaml
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

## Main Process 구조

### packages/main/src/
```
main/src/
├── main.ts              # 진입점
├── preload.ts           # Preload 스크립트
│
├── core/                # 핵심 기능
│   ├── window-manager.ts
│   ├── ipc-manager.ts
│   ├── config-manager.ts
│   ├── history-manager.ts
│   └── cache-manager.ts
│
├── services/            # 서비스 계층
│   ├── browser-service.ts
│   ├── storage-service.ts
│   ├── download-service.ts
│   └── print-service.ts
│
├── managers/            # 상태 관리
│   ├── tab-manager.ts
│   ├── session-manager.ts
│   ├── bookmark-manager.ts
│   └── settings-manager.ts
│
├── ipc/                 # IPC 핸들러
│   ├── window-ipc.ts
│   ├── tab-ipc.ts
│   ├── file-ipc.ts
│   ├── browser-ipc.ts
│   └── settings-ipc.ts
│
├── types/               # 타입 정의
│   ├── browser.ts
│   ├── ipc.ts
│   └── settings.ts
│
└── utils/               # 유틸 함수
    ├── logger.ts
    ├── path-resolver.ts
    └── validators.ts
```

#### Main Process 파일 예시

**main.ts** - SRP 준수
```typescript
import { app } from 'electron';
import { WindowManager } from './core/window-manager';
import { IPCManager } from './core/ipc-manager';

let windowManager: WindowManager;
let ipcManager: IPCManager;

app.on('ready', () => {
  windowManager = new WindowManager();
  ipcManager = new IPCManager();
  
  windowManager.createWindow();
  ipcManager.setup();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

**core/window-manager.ts**
```typescript
import { BrowserWindow, ipcMain } from 'electron';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  createWindow() {
    this.mainWindow = new BrowserWindow({...});
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  getWindow() {
    return this.mainWindow;
  }
}
```

## Renderer Process 구조

### packages/renderer/src/
```
renderer/src/
├── main.tsx             # 진입점
├── app.tsx              # Root 컴포넌트
│
├── components/
│   ├── ui/              # shadcn/ui 컴포넌트
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   │
│   ├── layout/          # 레이아웃 컴포넌트
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   ├── main-content.tsx
│   │   └── status-bar.tsx
│   │
│   ├── features/        # 기능별 컴포넌트
│   │   ├── browser/
│   │   │   ├── url-bar.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── web-view.tsx
│   │   ├── settings/
│   │   │   ├── settings-panel.tsx
│   │   │   └── preference-form.tsx
│   │   └── ascii-mode/
│   │       ├── ascii-renderer.tsx
│   │       └── terminal-view.tsx
│   │
│   └── common/
│       ├── error-boundary.tsx
│       └── loading-spinner.tsx
│
├── pages/               # 라우트 페이지
│   ├── home.tsx
│   ├── settings.tsx
│   └── not-found.tsx
│
├── stores/              # Zustand 스토어
│   ├── browser-store.ts
│   ├── ui-store.ts
│   ├── settings-store.ts
│   └── index.ts
│
├── hooks/               # 커스텀 훅 (최소화)
│   └── index.ts         # 재사용 불가 시 함수로
│
├── lib/                 # 유틸 함수
│   ├── electron-api.ts
│   ├── api-client.ts
│   ├── format-helpers.ts
│   └── validators.ts
│
├── types/               # TypeScript 타입
│   ├── browser.ts
│   ├── settings.ts
│   └── ipc.ts
│
└── styles/              # 글로벌 스타일
    ├── globals.css
    ├── tailwind.css
    └── ascii-mode.css
```

#### Renderer 파일 예시

**stores/browser-store.ts** - Zustand
```typescript
import { create } from 'zustand';

interface Tab {
  id: string;
  title: string;
  url: string;
  favicon?: string;
}

interface BrowserStore {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (url: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
}

export const useBrowserStore = create<BrowserStore>((set) => ({
  tabs: [],
  activeTabId: null,
  
  addTab: (url) => set((state) => {
    const tab: Tab = { id: Date.now().toString(), title: 'New Tab', url };
    return {
      tabs: [...state.tabs, tab],
      activeTabId: tab.id
    };
  }),

  closeTab: (id) => set((state) => ({
    tabs: state.tabs.filter(t => t.id !== id),
    activeTabId: state.activeTabId === id ? state.tabs[0]?.id || null : state.activeTabId
  })),

  setActiveTab: (id) => set({ activeTabId: id })
}));
```

**lib/electron-api.ts** - Type-safe IPC
```typescript
export const electronAPI = {
  browser: {
    openDevTools: () => window.electronAPI.openDevTools(),
    navigate: (url: string) => window.electronAPI.navigate(url),
    goBack: () => window.electronAPI.goBack(),
    goForward: () => window.electronAPI.goForward(),
    reload: () => window.electronAPI.reload()
  },

  settings: {
    load: () => window.electronAPI.loadSettings(),
    save: (settings: AppSettings) => window.electronAPI.saveSettings(settings)
  },

  file: {
    openFile: () => window.electronAPI.openFile(),
    saveFile: (data: string) => window.electronAPI.saveFile(data)
  }
};
```

## Preload 구조

### packages/preload/src/
```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

interface ElectronAPI {
  // Browser
  navigate: (url: string) => Promise<void>;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;

  // Settings
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<void>;

  // File
  openFile: () => Promise<string | null>;
  saveFile: (data: string) => Promise<boolean>;

  // Events
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
  onTabChanged: (callback: (tabId: string) => void) => () => void;
}

const electronAPI: ElectronAPI = {
  navigate: (url) => ipcRenderer.invoke('browser:navigate', url),
  goBack: () => ipcRenderer.send('browser:goBack'),
  goForward: () => ipcRenderer.send('browser:goForward'),
  reload: () => ipcRenderer.send('browser:reload'),

  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (data) => ipcRenderer.invoke('file:save', data),

  onSettingsChanged: (callback) => {
    ipcRenderer.on('settings:changed', (_event, settings) => callback(settings));
    return () => ipcRenderer.removeAllListeners('settings:changed');
  },

  onTabChanged: (callback) => {
    ipcRenderer.on('tab:changed', (_event, tabId) => callback(tabId));
    return () => ipcRenderer.removeAllListeners('tab:changed');
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

## Shared 타입

### packages/shared/src/types/
```
types/
├── browser.ts       # 브라우저 관련 타입
├── ipc.ts           # IPC 타입
├── settings.ts      # 설정 타입
└── index.ts         # 통합 내보내기
```

```typescript
// types/browser.ts
export interface Tab {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface BrowserState {
  tabs: Tab[];
  activeTabId: string | null;
  isUrlBarVisible: boolean;
}

// types/settings.ts
export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  asciiMode: boolean;
  defaultSearchEngine: string;
  homepage: string;
  language: string;
}
```

## 모듈 의존성 구조

```
Preload
  ↓ (exposes API)
Renderer (React)
  ├─→ Components
  ├─→ Stores (Zustand)
  ├─→ Hooks (minimal)
  └─→ Lib (utils)

Main Process
  ├─→ Window Manager
  ├─→ IPC Manager
  ├─→ Services
  └─→ Managers
      └─→ Core
```

## IPC 채널 규칙

### 명명 규칙
```
"domain:action"
```

### 예시
```
browser:navigate
browser:goBack
browser:goForward
browser:reload
settings:load
settings:save
file:open
file:save
```

## 보안 경계

```
┌─ Main Process (Node.js full access) ─┐
│  ✓ File System                        │
│  ✓ OS APIs                            │
│  ✓ 네이티브 모듈                      │
└──────────────────────────────────────┘
         ▲ IPC (필터링)
         │ (whitelist only)
┌────────┴──────────────────────────────┐
│ Preload (isolated context)             │
│  ✓ 선택적 IPC 노출                     │
│  ✗ Direct Node.js access              │
└────────┬──────────────────────────────┘
         │ window.electronAPI
┌────────┴──────────────────────────────┐
│ Renderer (sandboxed)                   │
│  ✗ File System                        │
│  ✗ OS APIs                            │
│  ✓ DOM access                         │
│  ✓ Web APIs                           │
└──────────────────────────────────────┘
```

## 주요 원칙

1. **SRP (Single Responsibility)**: 각 파일/클래스는 하나의 책임만 가짐
2. **의존성 주입**: 생성자를 통한 의존성 주입
3. **Type Safety**: 항상 TypeScript 타입 사용
4. **Modularity**: 모든 기능은 모듈로 구성
5. **Security**: 보안 경계 명확히 유지
6. **Testability**: 각 계층을 독립적으로 테스트 가능하게 구성
