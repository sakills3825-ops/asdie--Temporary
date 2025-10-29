/**
 * WindowService - 윈도우 제어 비즈니스 로직
 *
 * 책임: 윈도우 관리 로직
 * - 최소화, 최대화, 복원
 * - 전체화면 토글
 * - 윈도우 크기 조정
 *
 * SRP 원칙: 윈도우 제어 로직만 담당
 * 실제 윈도우 조작은 WindowManager(core)에 위임
 */

import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';

/**
 * WindowManager 인터페이스 (core/window.ts)
 */
interface IWindowManager {
  minimize(): void;
  maximize(): void;
  unmaximize(): void;
  close(): void;
  toggleFullscreen(): void;
  isMaximized(): boolean;
  isFullscreen(): boolean;
  getSize(): [number, number];
  setSize(width: number, height: number): void;
}

/**
 * 윈도우 서비스
 */
export class WindowService {
  private logger: ILogger;

  constructor(private windowManager: IWindowManager) {
    this.logger = new LoggerImpl('WindowService', LogLevel.INFO);
  }

  /**
   * 윈도우 최소화
   */
  public async minimize(): Promise<void> {
    try {
      this.logger.info('WindowService: Minimizing window');

      this.windowManager.minimize();

      this.logger.info('WindowService: Window minimized');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowService: Failed to minimize window', err);
      throw err;
    }
  }

  /**
   * 윈도우 최대화
   */
  public async maximize(): Promise<void> {
    try {
      this.logger.info('WindowService: Maximizing window');

      this.windowManager.maximize();

      this.logger.info('WindowService: Window maximized');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowService: Failed to maximize window', err);
      throw err;
    }
  }

  /**
   * 윈도우 복원 (최대화 해제)
   */
  public async restore(): Promise<void> {
    try {
      this.logger.info('WindowService: Restoring window');

      if (this.windowManager.isMaximized()) {
        this.windowManager.unmaximize();
      }

      this.logger.info('WindowService: Window restored');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowService: Failed to restore window', err);
      throw err;
    }
  }

  /**
   * 윈도우 닫기
   */
  public async close(): Promise<void> {
    try {
      this.logger.info('WindowService: Closing window');

      this.windowManager.close();

      this.logger.info('WindowService: Window closed');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowService: Failed to close window', err);
      throw err;
    }
  }

  /**
   * 윈도우 전체화면 토글
   */
  public async toggleFullscreen(): Promise<void> {
    try {
      const isFullscreen = this.windowManager.isFullscreen();
      this.logger.info('WindowService: Toggling fullscreen', {
        module: 'WindowService',
        metadata: { currentState: isFullscreen },
      });

      this.windowManager.toggleFullscreen();

      this.logger.info('WindowService: Fullscreen toggled', {
        module: 'WindowService',
        metadata: { newState: !isFullscreen },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowService: Failed to toggle fullscreen', err);
      throw err;
    }
  }

  /**
   * 최대화 상태 조회
   */
  public async isMaximized(): Promise<boolean> {
    try {
      return this.windowManager.isMaximized();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowService: Failed to check maximized state', err);
      throw err;
    }
  }

  /**
   * 전체화면 상태 조회
   */
  public async isFullscreen(): Promise<boolean> {
    try {
      return this.windowManager.isFullscreen();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowService: Failed to check fullscreen state', err);
      throw err;
    }
  }

  /**
   * 윈도우 크기 조회
   */
  public async getSize(): Promise<{ width: number; height: number }> {
    try {
      const [width, height] = this.windowManager.getSize();
      return { width, height };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowService: Failed to get window size', err);
      throw err;
    }
  }

  /**
   * 윈도우 크기 설정
   */
  public async setSize(width: number, height: number): Promise<void> {
    try {
      if (width <= 0 || height <= 0) {
        throw new Error('윈도우 크기는 0보다 커야 합니다');
      }

      this.logger.info('WindowService: Setting window size', {
        module: 'WindowService',
        metadata: { width, height },
      });

      this.windowManager.setSize(width, height);

      this.logger.info('WindowService: Window size set', {
        module: 'WindowService',
        metadata: { width, height },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowService: Failed to set window size', err);
      throw err;
    }
  }

  /**
   * 최대화 토글
   */
  public async toggleMaximize(): Promise<void> {
    try {
      this.logger.info('WindowService: Toggling maximize');

      if (this.windowManager.isMaximized()) {
        this.windowManager.unmaximize();
      } else {
        this.windowManager.maximize();
      }

      this.logger.info('WindowService: Maximize toggled');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('WindowService: Failed to toggle maximize', err);
      throw err;
    }
  }
}
