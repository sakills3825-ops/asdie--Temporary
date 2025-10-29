/**
 * AppLifecycle - Electron 앱 생명주기 관리
 *
 * 책임: Electron 앱의 생명주기 이벤트 처리
 * - app.ready: 앱 초기화 및 윈도우 생성
 * - app.before-quit: 리소스 정리
 * - app.activate (macOS): dock 클릭 시 윈도우 복구
 * - app.window-all-closed: 마지막 윈도우 종료 처리
 *
 * SRP 원칙: 오직 Electron 앱 이벤트 처리만 담당
 * 윈도우 생성은 WindowManager에, 비즈니스 로직은 services 계층에 위임
 */

import { app } from 'electron';
import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';
import type { WindowManager } from './window';

export type AppState = 'initializing' | 'initialized' | 'ready' | 'running' | 'shutting_down' | 'shutdown';

export interface AppLifecycleConfig {
  autoStartMinimized?: boolean;
  restorePreviousSession?: boolean;
  allowMultipleInstances?: boolean;
}

export class AppLifecycle {
  private logger: ILogger;
  private state: AppState = 'initializing';
  private config: AppLifecycleConfig;
  private quitting = false;

  constructor(
    private windowManager: WindowManager,
    config: AppLifecycleConfig = {}
  ) {
    this.logger = new LoggerImpl('AppLifecycle', LogLevel.INFO);
    this.config = {
      autoStartMinimized: false,
      restorePreviousSession: true,
      allowMultipleInstances: false,
      ...config,
    };
  }

  /**
   * 앱 초기화
   * - 단일 인스턴스 확인
   * - Electron 이벤트 등록
   * - 초기 윈도우 생성 준비
   */
  public async initialize(): Promise<void> {
    if (this.state !== 'initializing') {
      throw new Error(`Cannot initialize: app is already ${this.state}`);
    }

    try {
      this.logger.info('AppLifecycle: Initializing');

      if (!this.config.allowMultipleInstances) {
        this.ensureSingleInstance();
      }

      this.registerAppEvents();

      if (app.isReady()) {
        await this.onAppReady();
      }

      this.state = 'initialized';
      this.logger.info('AppLifecycle: Initialized successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('AppLifecycle: Initialization failed', err);
      this.state = 'shutdown';
      throw error;
    }
  }

  /**
   * 단일 인스턴스 확인 (중복 실행 방지)
   */
  private ensureSingleInstance(): void {
    const gotLock = app.requestSingleInstanceLock();

    if (!gotLock) {
      this.logger.warn('AppLifecycle: Another instance running, quitting');
      app.quit();
      process.exit(0);
    }

    app.on('second-instance', () => {
      this.logger.info('AppLifecycle: Second instance attempted');
      const windows = this.windowManager.getAllWindows();
      if (windows.length > 0) {
        const mainWindow = windows[0];
        if (mainWindow && mainWindow.isMinimized?.()) {
          mainWindow.restore?.();
        }
        mainWindow?.focus?.();
      }
    });
  }

  /**
   * Electron 앱 이벤트 등록
   */
  private registerAppEvents(): void {
    app.on('ready', () => this.onAppReady());
    app.on('before-quit', () => this.onBeforeQuit());
    app.on('quit', () => this.onAppQuit());
    app.on('activate', () => this.onAppActivate());
    app.on('window-all-closed', () => this.onWindowAllClosed());

    if (process.env.NODE_ENV !== 'development') {
      app.disableHardwareAcceleration();
    }
  }

  /**
   * app.ready 이벤트 핸들러
   */
  private async onAppReady(): Promise<void> {
    try {
      this.logger.info('AppLifecycle: App ready');

      const mainWindow = this.windowManager.createWindow({
        isMinimized: this.config.autoStartMinimized ?? false,
      });

      if (!mainWindow) {
        throw new Error('Failed to create main window');
      }

      this.state = 'ready';
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('AppLifecycle: Failed to handle app ready', err);
      app.quit();
    }
  }

  /**
   * app.before-quit 이벤트 핸들러 (리소스 정리)
   */
  private onBeforeQuit(): void {
    this.logger.info('AppLifecycle: Before quit');

    if (this.quitting) {
      return;
    }

    this.quitting = true;
    this.state = 'shutting_down';

    try {
      this.windowManager.closeAllWindows();
      this.logger.info('AppLifecycle: Cleanup complete');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('AppLifecycle: Cleanup error', err);
    }
  }

  /**
   * app.quit 이벤트 핸들러
   */
  private onAppQuit(): void {
    this.logger.info('AppLifecycle: App quit');
    this.state = 'shutdown';
  }

  /**
   * app.activate 이벤트 핸들러 (macOS dock 클릭)
   */
  private onAppActivate(): void {
    this.logger.info('AppLifecycle: App activate');

    const windows = this.windowManager.getAllWindows();
    if (windows.length === 0) {
      try {
        this.windowManager.createWindow();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error('AppLifecycle: Failed to create window on activate', err);
      }
    } else {
      const mainWindow = windows[0];
      if (mainWindow && mainWindow.isMinimized?.()) {
        mainWindow.restore?.();
      }
      mainWindow?.focus?.();
    }
  }

  /**
   * app.window-all-closed 이벤트 핸들러
   */
  private onWindowAllClosed(): void {
    this.logger.info('AppLifecycle: All windows closed');

    // macOS: Dock 아이콘 유지
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }

  // ============= Public API =============

  public getState(): AppState {
    return this.state;
  }

  public isReady(): boolean {
    return this.state === 'ready' || this.state === 'running';
  }

  public isQuitting(): boolean {
    return this.quitting;
  }

  public async quit(): Promise<void> {
    this.logger.info('AppLifecycle: Manual quit requested');
    app.quit();
  }

  public getConfig(): AppLifecycleConfig {
    return { ...this.config };
  }

  public updateConfig(config: Partial<AppLifecycleConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('AppLifecycle: Config updated');
  }
}
