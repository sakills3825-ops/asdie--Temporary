/**
 * WindowHandler - 윈도우 제어 IPC 핸들러
 *
 * 책임: IPC 요청을 받아서 WindowManager로 라우팅
 * - window:minimize
 * - window:maximize
 * - window:restore
 * - window:close
 * - window:toggleFullscreen
 *
 * SRP 원칙: IPC 요청 처리와 라우팅만 담당
 * 윈도우 제어 로직은 core/window.ts의 WindowManager에서 처리
 */ 

import { ipcMain } from 'electron';
import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';
import { IPC_CHANNELS } from '../../shared/ipc/channels';

/**
 * 윈도우 제어 서비스 인터페이스
 */
export interface IWindowService {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  restore(): Promise<void>;
  close(): Promise<void>;
  toggleFullscreen(): Promise<void>;
}

/**
 * 윈도우 제어 IPC 핸들러
 */
export class WindowHandler {
  private logger: ILogger;

  constructor(private windowService: IWindowService) {
    this.logger = new LoggerImpl('WindowHandler', LogLevel.INFO);
  }

  /**
   * 모든 윈도우 제어 IPC 핸들 등록
   */
  public registerHandlers(): void {
    this.logger.info('WindowHandler: Registering handlers');

    // 최소화
    ipcMain.handle(IPC_CHANNELS.windowMinimize, () => this.handleMinimize());

    // 최대화
    ipcMain.handle(IPC_CHANNELS.windowMaximize, () => this.handleMaximize());

    // 복원
    ipcMain.handle(IPC_CHANNELS.windowRestore, () => this.handleRestore());

    // 닫기
    ipcMain.handle(IPC_CHANNELS.windowClose, () => this.handleClose());

    // 전체화면 토글
    ipcMain.handle(IPC_CHANNELS.windowToggleFullscreen, () => this.handleToggleFullscreen());

    this.logger.info('WindowHandler: Handlers registered successfully');
  }

  /**
   * 에러 응답 생성 헬퍼
   */
  private formatErrorResponse(error: unknown, operation: string): { success: false; error: string } {
    if (error instanceof Error && 'code' in error && 'statusCode' in error) {
      const baseErr = error as any;
      this.logger.error(`WindowHandler: ${operation} failed`, baseErr);
      return { success: false, error: baseErr.message };
    }

    const err = error instanceof Error ? error : new Error(String(error));
    this.logger.error(`WindowHandler: ${operation} failed`, err);
    return { success: false, error: err.message };
  }

  /**
   * 윈도우 최소화 핸들러
   */
  private async handleMinimize() {
    try {
      this.logger.info('WindowHandler: Minimizing window');

      await this.windowService.minimize();
      return { success: true };
    } catch (error) {
      return this.formatErrorResponse(error, 'Minimizing window');
    }
  }

  /**
   * 윈도우 최대화 핸들러
   */
  private async handleMaximize() {
    try {
      this.logger.info('WindowHandler: Maximizing window');

      await this.windowService.maximize();
      return { success: true };
    } catch (error) {
      return this.formatErrorResponse(error, 'Maximizing window');
    }
  }

  /**
   * 윈도우 복원 핸들러
   */
  private async handleRestore() {
    try {
      this.logger.info('WindowHandler: Restoring window');

      await this.windowService.restore();
      return { success: true };
    } catch (error) {
      return this.formatErrorResponse(error, 'Restoring window');
    }
  }

  /**
   * 윈도우 종료 핸들러
   */
  private async handleClose() {
    try {
      this.logger.info('WindowHandler: Closing window');

      await this.windowService.close();
      return { success: true };
    } catch (error) {
      return this.formatErrorResponse(error, 'Closing window');
    }
  }

  /**
   * 전체화면 토글 핸들러
   */
  private async handleToggleFullscreen() {
    try {
      this.logger.info('WindowHandler: Toggling fullscreen');

      await this.windowService.toggleFullscreen();
      return { success: true };
    } catch (error) {
      return this.formatErrorResponse(error, 'Toggling fullscreen');
    }
  }

  /**
   * 모든 핸들러 등록 해제
   */
  public unregisterHandlers(): void {
    ipcMain.removeAllListeners(IPC_CHANNELS.windowMinimize);
    ipcMain.removeAllListeners(IPC_CHANNELS.windowMaximize);
    ipcMain.removeAllListeners(IPC_CHANNELS.windowRestore);
    ipcMain.removeAllListeners(IPC_CHANNELS.windowClose);
    ipcMain.removeAllListeners(IPC_CHANNELS.windowToggleFullscreen);

    this.logger.info('WindowHandler: Handlers unregistered');
  }
}
