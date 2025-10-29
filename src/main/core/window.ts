/**
 * WindowManager - 브라우저 윈도우 관리
 *
 * 책임: Electron BrowserWindow 생성, 관리, 이벤트 처리
 * - 윈도우 생성/삭제
 * - preload 스크립트 로드
 * - 윈도우 이벤트 처리 (close, minimize, maximize 등)
 * - 메인 윈도우 ID 추적
 *
 * SRP 원칙: 오직 윈도우 관리만 담당
 * 앱 생명주기는 AppLifecycle에, 이벤트 발행은 EventBus에 위임
 */

import { BrowserWindow, app, screen, session } from 'electron';
import path from 'path';
import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';
import { generateCspHeader } from '../../shared/security/csp';

/**
 * 빌드 환경 타입
 * - development: npm run dev (개발 모드)
 * - unpacked: electron-builder unpacked (언팩 상태, 개발용)
 * - packed-dmg: macOS 번들 (코드 서명됨)
 * - packed-exe: Windows 설치 파일
 * - packed-msi: Windows MSI 설치 파일
 */
export type BuildEnvironment = 'development' | 'unpacked' | 'packed-dmg' | 'packed-exe' | 'packed-msi';

/**
 * 빌드 환경 감지 결과
 */
export interface BuildInfo {
  environment: BuildEnvironment;
  isPacked: boolean; // app.isPackaged
  isProduction: boolean;
  isDevelopment: boolean;
  appPath: string;
  resourcesPath: string;
}

export interface WindowManagerConfig {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  show?: boolean;
  preloadPath?: string;
  buildInfo?: BuildInfo;
}

export interface CreateWindowOptions {
  isMinimized?: boolean;
  x?: number;
  y?: number;
}

/**
 * 브라우저 윈도우 관리자
 */
export class WindowManager {
  private logger: ILogger;
  private windows: Map<string, BrowserWindow> = new Map();
  private mainWindowId: string | null = null;
  private config: WindowManagerConfig;
  private buildInfo: BuildInfo;
  private windowCounter = 0;

  constructor(config: WindowManagerConfig = {}) {
    this.logger = new LoggerImpl('WindowManager', LogLevel.INFO);
    
    // BuildInfo 초기화
    this.buildInfo = config.buildInfo || this.detectBuildInfo();
    
    this.config = {
      width: 1440,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      show: true,
      ...config,
    };

    // CSP 헤더 설정 (모든 요청에 적용)
    this.setupCspHeaders();

    this.logger.info('WindowManager: Initialized', {
      module: 'WindowManager',
      metadata: {
        buildEnvironment: this.buildInfo.environment,
        isPacked: this.buildInfo.isPacked,
        isProduction: this.buildInfo.isProduction,
      },
    });
  }

  /**
   * CSP 헤더 설정
   * 모든 HTTP 요청 응답에 CSP 헤더를 추가
   *
   * @private
   */
  private setupCspHeaders(): void {
    try {
      const cspHeader = generateCspHeader();
      
      // 기본 세션의 모든 응답에 CSP 헤더 추가
      session.defaultSession?.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [cspHeader],
          },
        });
      });

      this.logger.info('WindowManager: CSP headers configured', {
        module: 'WindowManager',
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowManager: Failed to setup CSP headers', err);
    }
  }

  /**
   * 빌드 환경 자동 감지
   * app.isPackaged와 NODE_ENV를 조합하여 정확한 환경 판단
   *
   * @private
   */
  private detectBuildInfo(): BuildInfo {
    const isPacked = app.isPackaged;
    const nodeEnv = process.env.NODE_ENV;
    const isProduction = nodeEnv === 'production';
    const isDevelopment = nodeEnv === 'development';

    // 환경 판단
    let environment: BuildEnvironment = 'development';
    
    if (!isPacked) {
      // 언팩 상태 (개발용 빌드)
      environment = 'unpacked';
    } else if (isPacked && isProduction) {
      // 번들 상태 + production
      if (process.platform === 'darwin') {
        environment = 'packed-dmg';
      } else if (process.platform === 'win32') {
        // Windows에서는 일단 exe로 판단 (나중에 installer 타입 구분 가능)
        environment = 'packed-exe';
      }
    }

    return {
      environment,
      isPacked,
      isProduction,
      isDevelopment,
      appPath: app.getAppPath(),
      resourcesPath: path.join(app.getAppPath(), isPacked ? '' : ''),
    };
  }

  /**
   * BuildInfo 조회
   */
  public getBuildInfo(): BuildInfo {
    return { ...this.buildInfo };
  }

  /**
   * 프로덕션 환경인지 확인
   */
  public isProduction(): boolean {
    return this.buildInfo.isProduction;
  }

  /**
   * 번들 상태인지 확인
   */
  public isPacked(): boolean {
    return this.buildInfo.isPacked;
  }

  /**
   * 새 브라우저 윈도우 생성
   *
   * @param options 윈도우 옵션
   * @returns 생성된 BrowserWindow 또는 null (실패 시)
   */
  public createWindow(options: CreateWindowOptions = {}): BrowserWindow | null {
    try {
      this.logger.info('WindowManager: Creating window');

      const width = this.config.width ?? 1200;
      const height = this.config.height ?? 800;
      const { isMinimized = false, x, y } = options;

      // 윈도우 위치 계산
      const { x: screenX, y: screenY } = this.calculateWindowPosition(x, y);

      // BrowserWindow 생성
      const window = new BrowserWindow({
        width,
        height,
        minWidth: this.config.minWidth ?? 800,
        minHeight: this.config.minHeight ?? 600,
        x: screenX,
        y: screenY,
        show: !isMinimized && (this.config.show ?? true),
        webPreferences: {
          preload: this.getPreloadPath(),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });

      // 윈도우 ID 생성
      const windowId = `window-${this.windowCounter++}`;

      // 이벤트 등록
      this.setupWindowEvents(window, windowId);

      // 저장소에 추가
      this.windows.set(windowId, window);

      // 메인 윈도우 설정
      if (this.mainWindowId === null) {
        this.mainWindowId = windowId;
      }

      // 개발 환경: DevTools 열기
      if (this.buildInfo.isDevelopment) {
        window.webContents.openDevTools();
      }

      // URL 로드
      this.loadURL(window);

      if (isMinimized) {
        window.minimize();
      }

      this.logger.info('WindowManager: Window created', {
        module: 'WindowManager',
        metadata: { windowId, width, height },
      });

      return window;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowManager: Failed to create window', err);
      return null;
    }
  }

  /**
   * 특정 윈도우 닫기
   *
   * @param id 윈도우 ID
   */
  public closeWindow(id: string): void {
    try {
      const window = this.windows.get(id);
      if (window) {
        window.close();
        this.logger.info('WindowManager: Window closed', {
          module: 'WindowManager',
          metadata: { windowId: id },
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowManager: Failed to close window', err);
    }
  }

  /**
   * 모든 윈도우 닫기
   */
  public closeAllWindows(): void {
    try {
      this.logger.info('WindowManager: Closing all windows');
      for (const window of this.windows.values()) {
        if (!window.isDestroyed()) {
          window.close();
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowManager: Failed to close all windows', err);
    }
  }

  /**
   * 메인 윈도우 최소화
   */
  public minimize(): void {
    try {
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.minimize();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowManager: Failed to minimize main window', err);
    }
  }

  /**
   * 메인 윈도우 최대화
   */
  public maximize(): void {
    try {
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.maximize();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowManager: Failed to maximize main window', err);
    }
  }

  /**
   * 메인 윈도우 복원 (최대화 해제)
   */
  public unmaximize(): void {
    try {
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.unmaximize();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowManager: Failed to unmaximize main window', err);
    }
  }

  /**
   * 메인 윈도우 닫기
   */
  public close(): void {
    try {
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowManager: Failed to close main window', err);
    }
  }

  /**
   * 메인 윈도우 전체화면 토글
   */
  public toggleFullscreen(): void {
    try {
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowManager: Failed to toggle fullscreen', err);
    }
  }

  /**
   * 메인 윈도우가 최대화되었는지 확인
   */
  public isMaximized(): boolean {
    const mainWindow = this.getMainWindow();
    return mainWindow ? mainWindow.isMaximized() : false;
  }

  /**
   * 메인 윈도우가 전체화면인지 확인
   */
  public isFullscreen(): boolean {
    const mainWindow = this.getMainWindow();
    return mainWindow ? mainWindow.isFullScreen() : false;
  }

  /**
   * 메인 윈도우 크기 조회
   */
  public getSize(): [number, number] {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      const size = mainWindow.getSize() as [number, number];
      return size;
    }
    return [1200, 800];
  }

  /**
   * 메인 윈도우 크기 설정
   */
  public setSize(width: number, height: number): void {
    try {
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setSize(width, height);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowManager: Failed to set window size', err);
    }
  }

  /**
   * 윈도우 포커스
   *
   * @param id 윈도우 ID
   */
  public focusWindow(id: string): void {
    try {
      const window = this.windows.get(id);
      if (window && !window.isDestroyed()) {
        if (window.isMinimized()) {
          window.restore();
        }
        window.focus();
        this.logger.info('WindowManager: Window focused', {
          module: 'WindowManager',
          metadata: { windowId: id },
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowManager: Failed to focus window', err);
    }
  }

  /**
   * 특정 윈도우 조회
   *
   * @param id 윈도우 ID
   * @returns BrowserWindow 또는 null
   */
  public getWindow(id: string): BrowserWindow | null {
    return this.windows.get(id) ?? null;
  }

  /**
   * 모든 윈도우 조회
   *
   * @returns BrowserWindow 배열
   */
  public getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values()).filter((w) => !w.isDestroyed());
  }

  /**
   * 메인 윈도우 조회
   *
   * @returns 메인 BrowserWindow 또는 null
   */
  public getMainWindow(): BrowserWindow | null {
    if (this.mainWindowId === null) {
      return null;
    }
    return this.getWindow(this.mainWindowId);
  }

  /**
   * 윈도우 개수 조회
   *
   * @returns 현재 열려있는 윈도우 개수
   */
  public getWindowCount(): number {
    return this.getAllWindows().length;
  }

  /**
   * 윈도우 이벤트 등록
   *
   * @private
   */
  private setupWindowEvents(window: BrowserWindow, windowId: string): void {
    // 윈도우 닫힐 때
    window.on('closed', () => {
      this.logger.info('WindowManager: Window closed event', {
        module: 'WindowManager',
        metadata: { windowId },
      });
      this.windows.delete(windowId);

      // 메인 윈도우가 닫혔으면 초기화
      if (this.mainWindowId === windowId) {
        this.mainWindowId = null;
      }
    });

    // 최소화
    window.on('minimize', () => {
      this.logger.debug('WindowManager: Window minimized', {
        module: 'WindowManager',
        metadata: { windowId },
      });
    });

    // 최대화
    window.on('maximize', () => {
      this.logger.debug('WindowManager: Window maximized', {
        module: 'WindowManager',
        metadata: { windowId },
      });
    });

    // 복원
    window.on('restore', () => {
      this.logger.debug('WindowManager: Window restored', {
        module: 'WindowManager',
        metadata: { windowId },
      });
    });

    // 포커스
    window.on('focus', () => {
      this.logger.debug('WindowManager: Window focused', {
        module: 'WindowManager',
        metadata: { windowId },
      });
    });

    // 블러 (포커스 상실)
    window.on('blur', () => {
      this.logger.debug('WindowManager: Window blurred', {
        module: 'WindowManager',
        metadata: { windowId },
      });
    });

    // 로드 완료
    window.webContents.on('did-finish-load', () => {
      this.logger.info('WindowManager: Content loaded', {
        module: 'WindowManager',
        metadata: { windowId },
      });
    });

    // unresponsive 이벤트 (응답 없음)
    window.webContents.on('unresponsive', () => {
      this.logger.warn('WindowManager: Renderer unresponsive', {
        module: 'WindowManager',
        metadata: { windowId },
      });
    });
  }

  /**
   * 윈도우 위치 계산 (중앙 배치)
   *
   * @private
   */
  private calculateWindowPosition(x?: number, y?: number): { x: number; y: number } {
    if (x !== undefined && y !== undefined) {
      return { x, y };
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const width = this.config.width || 1200;
    const height = this.config.height || 800;

    return {
      x: Math.round((screenWidth - width) / 2),
      y: Math.round((screenHeight - height) / 2),
    };
  }

  /**
   * Preload 스크립트 경로 조회
   *
   * @private
   */
  private getPreloadPath(): string {
    if (this.config.preloadPath) {
      return this.config.preloadPath;
    }

    // app.isPackaged에 따라 경로 결정
    if (this.buildInfo.isPacked) {
      // 번들 상태: asar 내부 리소스 경로
      // app.getAppPath()는 이미 app.asar를 포함
      return path.join(app.getAppPath(), 'dist', 'preload.js');
    } else {
      // 개발/언팩 상태: 일반 dist 폴더
      return path.join(app.getAppPath(), 'dist', 'preload.js');
    }
  }

  /**
   * URL 로드
   *
   * 환경에 따라 로드 방식 결정:
   * - development: localhost Vite dev server
   * - unpacked: file:// 프로토콜 (로컬 파일)
   * - packed: app.asar 내 파일
   *
   * @private
   */
  private loadURL(window: BrowserWindow): void {
    switch (this.buildInfo.environment) {
      case 'development':
        // 개발: localhost Vite dev server (npm run dev)
        window.loadURL('http://localhost:5173');
        this.logger.info('WindowManager: Loading from Vite dev server');
        break;

      case 'unpacked':
      case 'packed-dmg':
      case 'packed-exe':
      case 'packed-msi':
        // 패키징된 상태: file:// 프로토콜
        const filePath = path.join(app.getAppPath(), 'dist', 'index.html');
        window.loadFile(filePath);
        this.logger.info('WindowManager: Loading from file', {
          module: 'WindowManager',
          metadata: { path: filePath },
        });
        break;

      default:
        // fallback
        this.logger.error('WindowManager: Unknown build environment', {
          module: 'WindowManager',
          metadata: { environment: this.buildInfo.environment },
        });
        window.loadURL('http://localhost:5173');
    }
  }

  /**
   * 설정 조회
   *
   * @returns 현재 설정
   */
  public getConfig(): WindowManagerConfig {
    return { ...this.config };
  }

  /**
   * 설정 업데이트
   *
   * @param config 업데이트할 설정
   */
  public updateConfig(config: Partial<WindowManagerConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('WindowManager: Config updated');
  }
}
