# TypeScript + 보안 + 개발 최적화 가이드

## TypeScript 5.x 설정

### 엄격한 타입 체킹
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    
    /* 엄격 모드 */
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    
    /* 추가 검사 */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    
    /* 출력 */
    "noEmit": true,
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

## 보안 아키텍처

### 1. IPC 화이트리스트

**types/ipc.ts**
```typescript
// 허용된 IPC 채널 정의
export const IPC_CHANNELS = {
  BROWSER: {
    NAVIGATE: 'browser:navigate',
    GO_BACK: 'browser:goBack',
    GO_FORWARD: 'browser:goForward',
    RELOAD: 'browser:reload'
  },
  SETTINGS: {
    LOAD: 'settings:load',
    SAVE: 'settings:save'
  },
  FILE: {
    OPEN: 'file:open',
    SAVE: 'file:save'
  }
} as const;

// 타입 안전성을 위한 Union 타입
export type IpcChannel = 
  | typeof IPC_CHANNELS.BROWSER[keyof typeof IPC_CHANNELS.BROWSER]
  | typeof IPC_CHANNELS.SETTINGS[keyof typeof IPC_CHANNELS.SETTINGS]
  | typeof IPC_CHANNELS.FILE[keyof typeof IPC_CHANNELS.FILE];
```

### 2. Preload 검증

**preload.ts**
```typescript
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC_CHANNELS, type IpcChannel } from './types/ipc';

// 화이트리스트 검증
const validateChannel = (channel: any): channel is IpcChannel => {
  const channels = Object.values(IPC_CHANNELS).flatMap(
    obj => Object.values(obj)
  );
  return channels.includes(channel);
};

interface ElectronAPI {
  invoke: (channel: IpcChannel, ...args: any[]) => Promise<any>;
  send: (channel: IpcChannel, ...args: any[]) => void;
  on: (channel: IpcChannel, callback: (...args: any[]) => void) => () => void;
}

const electronAPI: ElectronAPI = {
  invoke: (channel, ...args) => {
    if (!validateChannel(channel)) {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  send: (channel, ...args) => {
    if (!validateChannel(channel)) {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
    ipcRenderer.send(channel, ...args);
  },

  on: (channel, callback) => {
    if (!validateChannel(channel)) {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
    const listener = (_event: IpcRendererEvent, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
```

### 3. Main Process 검증

**ipc/validators.ts**
```typescript
import { IpcMainEvent } from 'electron';
import { URL } from 'url';

export interface IpcValidationContext {
  event: IpcMainEvent;
  args: any[];
}

// URL 검증
export function validateURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// 발신자 검증
export function validateSender(event: IpcMainEvent): boolean {
  // 신뢰된 출처만 허용
  const trustedHosts = ['app://', 'localhost'];
  const senderUrl = event.senderFrame.url;
  return trustedHosts.some(host => senderUrl.startsWith(host));
}

// 파일 경로 검증
export function validateFilePath(filePath: string): boolean {
  // 상위 디렉토리 접근 방지
  if (filePath.includes('..')) {
    return false;
  }
  // 절대 경로만 허용
  return require('path').isAbsolute(filePath);
}

// 페이로드 크기 제한
export function validatePayloadSize(data: any, maxSize: number = 10 * 1024 * 1024): boolean {
  const size = JSON.stringify(data).length;
  return size <= maxSize;
}
```

**ipc/handlers.ts**
```typescript
import { ipcMain, dialog } from 'electron';
import { validateSender, validateURL, validateFilePath } from './validators';

// 파일 다이얼로그 - 검증 있음
ipcMain.handle('file:open', async (event) => {
  // 1. 발신자 검증
  if (!validateSender(event)) {
    throw new Error('Unauthorized');
  }

  // 2. 다이얼로그 실행
  const { filePath } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  return filePath;
});

// URL 네비게이션 - 검증 있음
ipcMain.handle('browser:navigate', async (event, url: unknown) => {
  // 1. 발신자 검증
  if (!validateSender(event)) {
    throw new Error('Unauthorized');
  }

  // 2. URL 검증
  if (typeof url !== 'string' || !validateURL(url)) {
    throw new Error('Invalid URL');
  }

  // 3. 네비게이션 수행
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.loadURL(url);
  }
});
```

## Error Handling & Logging

### 로거 설정

**utils/logger.ts**
```typescript
import path from 'path';
import fs from 'fs';

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export class Logger {
  private logDir: string;

  constructor(logDir: string) {
    this.logDir = logDir;
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private formatLog(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}`;
  }

  private writeLog(level: LogLevel, message: string, data?: any): void {
    const logFile = path.join(this.logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
    const logMessage = this.formatLog(level, message, data);
    fs.appendFileSync(logFile, logMessage + '\n');
  }

  debug(message: string, data?: any) {
    console.debug(message, data);
    this.writeLog(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any) {
    console.info(message, data);
    this.writeLog(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any) {
    console.warn(message, data);
    this.writeLog(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error) {
    console.error(message, error);
    this.writeLog(LogLevel.ERROR, message, {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });
  }
}

export const logger = new Logger(path.join(app.getPath('userData'), 'logs'));
```

### 에러 경계

**components/error-boundary.tsx**
```typescript
import React, { ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('React Error Boundary caught an error', error);
    console.error('Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h2 className="text-red-800 font-bold">Something went wrong</h2>
          <details className="text-red-600 text-sm mt-2">
            <summary>Error details</summary>
            <pre className="mt-2 bg-red-100 p-2 rounded overflow-auto">
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## 성능 모니터링

### 성능 메트릭

**lib/performance.ts**
```typescript
export interface PerformanceMetrics {
  appStart: number;
  mainProcessStart: number;
  rendererReady: number;
  firstRender: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    appStart: Date.now(),
    mainProcessStart: 0,
    rendererReady: 0,
    firstRender: 0
  };

  recordMainProcessStart() {
    this.metrics.mainProcessStart = Date.now();
  }

  recordRendererReady() {
    this.metrics.rendererReady = Date.now();
  }

  recordFirstRender() {
    this.metrics.firstRender = Date.now();
  }

  getStartupTime() {
    return {
      total: this.metrics.firstRender - this.metrics.appStart,
      mainProcess: this.metrics.rendererReady - this.metrics.mainProcessStart,
      renderer: this.metrics.firstRender - this.metrics.rendererReady
    };
  }

  logMetrics() {
    const times = this.getStartupTime();
    console.log('📊 Performance Metrics:', times);
  }
}

export const performanceMonitor = new PerformanceMonitor();
```

## 개발 도구

### ESLint 설정

**.eslintrc.cjs**
```javascript
module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', '@typescript-eslint'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true }
    ],
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
    'react/react-in-jsx-scope': 'off'
  }
};
```

### 타입 체크 스크립트

**package.json**
```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

## Prisma 설정 (선택사항)

### schema.prisma
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model BrowserHistory {
  id        String   @id @default(cuid())
  url       String
  title     String
  timestamp DateTime @default(now())
  favicon   String?

  @@index([timestamp])
  @@index([url])
}

model Bookmark {
  id        String   @id @default(cuid())
  url       String   @unique
  title     String
  folder    String   @default("root")
  createdAt DateTime @default(now())

  @@index([folder])
}
```

## 앱 라이프사이클 체크리스트

### 시작 (startup)
- [ ] 환경변수 로드
- [ ] 로거 초기화
- [ ] 성능 모니터 시작
- [ ] 데이터베이스 연결
- [ ] IPC 핸들러 등록
- [ ] 메인 윈도우 생성

### 종료 (shutdown)
- [ ] 열린 파일 닫기
- [ ] 데이터베이스 연결 종료
- [ ] 캐시 정리
- [ ] 로그 플러시
- [ ] 성능 메트릭 기록

```typescript
import { app } from 'electron';
import { logger } from './utils/logger';
import { performanceMonitor } from './utils/performance';

// 시작
app.on('ready', async () => {
  logger.info('🚀 App starting...');
  performanceMonitor.recordMainProcessStart();
  
  // 초기화...
  
  performanceMonitor.recordRendererReady();
  logger.info('✅ App ready');
});

// 종료
app.on('before-quit', () => {
  logger.info('🛑 App shutting down...');
  performanceMonitor.logMetrics();
  // 정리...
});

app.on('quit', () => {
  logger.info('✨ App quit');
});
```

## 호환성

- **TypeScript 5.x**: 최신 LTS
- **Electron 38 LTS**: 호환
- **React 19**: 호환
- **Node.js 20 LTS**: 호환
