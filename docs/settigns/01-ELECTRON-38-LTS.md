# Electron 38 LTS 가이드

## 개요
Electron 38은 최신 LTS 버전으로 안정적이고 지원 기간이 긴 버전입니다.
현재 2025년 기준으로 최신 LTS입니다.

## 주요 아키텍처

### Main / Preload / Renderer 프로세스 구조

```
┌─────────────────────────────────────────┐
│        Electron App (Main Process)      │
│  - 앱 생명주기 관리                      │
│  - OS 레벨 API 접근                     │
│  - IPC 중앙 관리                        │
└──────────┬──────────────────────────────┘
           │
           ├─────────────────┬──────────────┐
           ▼                 ▼              ▼
      ┌────────┐        ┌────────┐    ┌────────┐
      │Preload │        │Renderer│    │Renderer│
      │Script  │        │Process1│    │Process2│
      │        │        │        │    │        │
      └────────┘        └────────┘    └────────┘
```

### 보안 아키텍처

#### Context Isolation
```javascript
// main.ts - BrowserWindow 생성
const mainWindow = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.ts'),
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false
  }
});
```

#### Preload Script (안전한 API 노출)
```typescript
// preload.ts
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ✅ 좋은 예: 필터링된 함수 노출
  onUpdateCounter: (callback: Function) => 
    ipcRenderer.on('update-counter', (_event, value) => callback(value)),
  
  setTitle: (title: string) => 
    ipcRenderer.send('set-title', title),
  
  openFile: () => 
    ipcRenderer.invoke('dialog:openFile')
});

// ❌ 나쁜 예: 전체 ipcRenderer 노출
// contextBridge.exposeInMainWorld('ipc', ipcRenderer); // 위험!
```

## IPC 통신 패턴

### 1. 메인 → 렌더러 (단방향)
```typescript
// main.ts
mainWindow.webContents.send('update-counter', 1);

// renderer.ts
window.electronAPI.onUpdateCounter((value) => {
  console.log('Received:', value);
});
```

### 2. 렌더러 → 메인 (단방향)
```typescript
// preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (title: string) => ipcRenderer.send('set-title', title)
});

// main.ts
ipcMain.on('set-title', (event, title) => {
  mainWindow.setTitle(title);
});
```

### 3. 비동기 요청-응답 (invoke/handle)
```typescript
// preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile')
});

// renderer.ts
const filePath = await window.electronAPI.openFile();

// main.ts
ipcMain.handle('dialog:openFile', async () => {
  const { filePath } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile']
  });
  return filePath;
});
```

## BrowserWindow / BrowserView (권장 업데이트)

### 최신 WebContentsView 사용
```typescript
// ⚠️ BrowserView는 Deprecated
// ✅ WebContentsView 사용 권장

import { BrowserWindow, WebContentsView } from 'electron';

const win = new BrowserWindow({ width: 800, height: 600 });
const view = new WebContentsView();
win.contentView.addChildView(view);
view.setBounds({ x: 0, y: 0, width: 300, height: 600 });
view.webContents.loadURL('https://example.com');
```

## 보안 권장사항

### 1. 앱 시작 시
```typescript
// main.ts
import { app } from 'electron';

// 샌드박스 활성화 (모든 렌더러 프로세스)
app.enableSandbox();

app.whenReady().then(() => {
  createWindow();
});
```

### 2. CSP (Content Security Policy) 설정
```typescript
// main.ts
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'"
      ]
    }
  });
});
```

### 3. 위험한 설정 피하기
```typescript
// ❌ 나쁜 예들
const win = new BrowserWindow({
  webPreferences: {
    nodeIntegration: true,          // ❌ 위험!
    sandbox: false,                 // ❌ 위험!
    webSecurity: false,             // ❌ 위험!
    allowRunningInsecureContent: true // ❌ 위험!
  }
});

// ✅ 권장 설정
const win = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,         // ✅
    sandbox: true,                  // ✅
    webSecurity: true,              // ✅
    preload: preloadPath,
    contextIsolation: true
  }
});
```

## 라이프사이클 관리

```typescript
import { app, BrowserWindow } from 'electron';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.ts'),
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 앱 시작
app.on('ready', createWindow);

// 모든 창 닫힘 → 앱 종료 (macOS 제외)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS: Dock 아이콘 클릭 시 창 재생성
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 앱 종료 시 정리
app.on('before-quit', () => {
  // 데이터 저장, 리소스 정리 등
  console.log('App is about to quit');
});

app.on('quit', () => {
  console.log('App quit');
});
```

## 개발 vs 프로덕션

```typescript
function isDev(): boolean {
  return !app.isPackaged;
}

function createWindow() {
  mainWindow = new BrowserWindow({...});

  if (isDev()) {
    // 개발 환경: Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // 프로덕션: 패키징된 리소스
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}
```

## 관련 LTS 호환성

- **Electron 38 LTS**: 안정적, 장기 지원
- **Node.js 20 LTS**: 호환
- **Chrome/Chromium**: 최신 안정 버전
- **V8 JavaScript Engine**: 최신 LTS 호환

## 주요 변경사항 (Electron 37→38)

- WebContentsView 안정화
- 보안 개선사항
- 성능 최적화
- 의존성 업데이트
