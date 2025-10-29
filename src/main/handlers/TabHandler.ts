/**
 * TabHandler - 탭 IPC 핸들러
 *
 * 책임: IPC 요청을 받아서 TabService로 라우팅
 * - tab:createNew
 * - tab:close
 * - tab:select
 * - tab:update
 * - tab:getAll
 * - tab:duplicate
 * - tab:mute
 * - tab:pin
 *
 * SRP 원칙: IPC 요청 처리와 라우팅만 담당
 * 비즈니스 로직은 TabService에 위임
 */

import { ipcMain } from 'electron';
import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';
import { IPC_CHANNELS } from '../../shared/ipc/channels';
import {
  TabCreateRequestSchema,
  TabUpdateRequestSchema,
  TabIdRequestSchema,
} from '../../shared/ipc/validators';
import type { BaseError } from '../../shared/errors';
import {
  validateUrlWithError,
  validateTitleWithError,
} from './InputValidator';

/**
 * TabService 인터페이스 (Phase 4에서 구현)
 */
export interface TabUpdateRequest {
  title?: string | undefined;
  url?: string | undefined;
  isActive?: boolean | undefined;
  isLoading?: boolean | undefined;
}

export interface ITabService {
  createTab(url: string, title?: string): Promise<{ id: string; url: string; title: string }>;
  closeTab(tabId: string): Promise<void>;
  selectTab(tabId: string): Promise<void>;
  updateTab(tabId: string, updates: TabUpdateRequest): Promise<{ id: string; url: string; title: string }>;
  getAllTabs(): Promise<Array<{ id: string; url: string; title: string }>>;
  duplicateTab(tabId: string): Promise<{ id: string; url: string; title: string }>;
  muteTab(tabId: string): Promise<void>;
  pinTab(tabId: string): Promise<void>;
}

/**
 * 탭 IPC 핸들러
 */
export class TabHandler {
  private logger: ILogger;

  constructor(private tabService: ITabService) {
    this.logger = new LoggerImpl('TabHandler', LogLevel.INFO);
  }

  /**
   * 모든 탭 IPC 핸들 등록
   */
  public registerHandlers(): void {
    this.logger.info('TabHandler: Registering handlers');

    // 새 탭 생성
    ipcMain.handle(IPC_CHANNELS.tabCreateNew, (_event, url: string, title?: string) =>
      this.handleCreateTab(url, title)
    );

    // 탭 닫기
    ipcMain.handle(IPC_CHANNELS.tabClose, (_event, tabId: string) => this.handleCloseTab(tabId));

    // 탭 선택
    ipcMain.handle(IPC_CHANNELS.tabSelect, (_event, tabId: string) => this.handleSelectTab(tabId));

    // 탭 정보 업데이트
    ipcMain.handle(IPC_CHANNELS.tabUpdate, (_event, tabId: string, updates: TabUpdateRequest) =>
      this.handleUpdateTab(tabId, updates)
    );

    // 모든 탭 조회
    ipcMain.handle(IPC_CHANNELS.tabGetAll, () => this.handleGetAllTabs());

    // 탭 복제
    ipcMain.handle(IPC_CHANNELS.tabDuplicate, (_event, tabId: string) =>
      this.handleDuplicateTab(tabId)
    );

    // 탭 음소거
    ipcMain.handle(IPC_CHANNELS.tabMute, (_event, tabId: string) => this.handleMuteTab(tabId));

    // 탭 고정
    ipcMain.handle(IPC_CHANNELS.tabPin, (_event, tabId: string) => this.handlePinTab(tabId));

    this.logger.info('TabHandler: Handlers registered successfully');
  }

  /**
   * 에러 응답 생성 헬퍼
   * BaseError 타입 감지 및 로깅
   */
  private formatErrorResponse(error: unknown, operation: string): { success: false; error: string } {
    // BaseError 구조 감지 (instanceof 대신 구조 기반)
    if (error instanceof Error && 'code' in error && 'statusCode' in error) {
      const baseErr = error as BaseError;
      this.logger.error(`TabHandler: ${operation} failed`, baseErr);
      return { success: false, error: baseErr.message };
    }

    // 일반 Error
    const err = error instanceof Error ? error : new Error(String(error));
    this.logger.error(`TabHandler: ${operation} failed`, err);
    return { success: false, error: err.message };
  }

  /**
   * 탭 입력 검증
   */
  private validateCreateTabInput(
    url: string,
    title?: string
  ): { valid: boolean; error?: string } {
    // 입력값 검증 1: 타입 확인
    if (typeof url !== 'string') {
      return { valid: false, error: 'URL은 문자열이어야 합니다' };
    }

    // 입력값 검증 2: URL 형식 확인
    const urlValidation = validateUrlWithError(url);
    if (!urlValidation.valid) {
      return urlValidation;
    }

    // 입력값 검증 3: 제목 길이 확인
    const titleValidation = validateTitleWithError(title || undefined, 500);
    if (!titleValidation.valid) {
      return titleValidation;
    }

    return { valid: true };
  }

  /**
   * 새 탭 생성 핸들러
   */
  private async handleCreateTab(url: string, title: string = '') {
    try {
      // 입력값 검증
      const validation = this.validateCreateTabInput(url, title);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Zod 검증
      const validated = TabCreateRequestSchema.parse({
        url,
        title: title || undefined,
      });

      this.logger.info('TabHandler: Creating tab', {
        module: 'TabHandler',
        metadata: { url: validated.url },
      });

      const tab = await this.tabService.createTab(validated.url, validated.title);
      return { success: true, data: tab };
    } catch (error) {
      return this.formatErrorResponse(error, 'Creating tab');
    }
  }

  /**
   * 탭 닫기 핸들러
   */
  private async handleCloseTab(tabId: string) {
    try {
      // 입력값 검증
      const validated = TabIdRequestSchema.parse({ tabId });

      this.logger.info('TabHandler: Closing tab', {
        module: 'TabHandler',
        metadata: { tabId: validated.tabId },
      });

      await this.tabService.closeTab(validated.tabId);
      return { success: true };
    } catch (error) {
      return this.formatErrorResponse(error, 'Closing tab');
    }
  }

  /**
   * 탭 선택 핸들러
   */
  private async handleSelectTab(tabId: string) {
    try {
      // 입력값 검증
      const validated = TabIdRequestSchema.parse({ tabId });

      this.logger.info('TabHandler: Selecting tab', {
        module: 'TabHandler',
        metadata: { tabId: validated.tabId },
      });

      await this.tabService.selectTab(validated.tabId);
      return { success: true };
    } catch (error) {
      return this.formatErrorResponse(error, 'Selecting tab');
    }
  }

  /**
   * 탭 정보 업데이트 핸들러
   */
  private async handleUpdateTab(tabId: string, updates: TabUpdateRequest) {
    try {
      // 입력값 검증
      const validated = TabUpdateRequestSchema.parse({ tabId, updates });

      this.logger.info('TabHandler: Updating tab', {
        module: 'TabHandler',
        metadata: { tabId: validated.tabId },
      });

      const tab = await this.tabService.updateTab(validated.tabId, validated.updates);
      return { success: true, data: tab };
    } catch (error) {
      return this.formatErrorResponse(error, 'Updating tab');
    }
  }

  /**
   * 모든 탭 조회 핸들러
   */
  private async handleGetAllTabs() {
    try {
      this.logger.info('TabHandler: Getting all tabs');

      const tabs = await this.tabService.getAllTabs();
      return { success: true, data: tabs };
    } catch (error) {
      return this.formatErrorResponse(error, 'Getting all tabs');
    }
  }

  /**
   * 탭 복제 핸들러
   */
  private async handleDuplicateTab(tabId: string) {
    try {
      // 입력값 검증
      const validated = TabIdRequestSchema.parse({ tabId });

      this.logger.info('TabHandler: Duplicating tab', {
        module: 'TabHandler',
        metadata: { tabId: validated.tabId },
      });

      const tab = await this.tabService.duplicateTab(validated.tabId);
      return { success: true, data: tab };
    } catch (error) {
      return this.formatErrorResponse(error, 'Duplicating tab');
    }
  }

  /**
   * 탭 음소거 핸들러
   */
  private async handleMuteTab(tabId: string) {
    try {
      // 입력값 검증
      const validated = TabIdRequestSchema.parse({ tabId });

      this.logger.info('TabHandler: Muting tab', {
        module: 'TabHandler',
        metadata: { tabId: validated.tabId },
      });

      await this.tabService.muteTab(validated.tabId);
      return { success: true };
    } catch (error) {
      return this.formatErrorResponse(error, 'Muting tab');
    }
  }

  /**
   * 탭 고정 핸들러
   */
  private async handlePinTab(tabId: string) {
    try {
      // 입력값 검증
      const validated = TabIdRequestSchema.parse({ tabId });

      this.logger.info('TabHandler: Pinning tab', {
        module: 'TabHandler',
        metadata: { tabId: validated.tabId },
      });

      await this.tabService.pinTab(validated.tabId);
      return { success: true };
    } catch (error) {
      return this.formatErrorResponse(error, 'Pinning tab');
    }
  }

  /**
   * 모든 핸들러 등록 해제
   */
  public unregisterHandlers(): void {
    ipcMain.removeAllListeners(IPC_CHANNELS.tabCreateNew);
    ipcMain.removeAllListeners(IPC_CHANNELS.tabClose);
    ipcMain.removeAllListeners(IPC_CHANNELS.tabSelect);
    ipcMain.removeAllListeners(IPC_CHANNELS.tabUpdate);
    ipcMain.removeAllListeners(IPC_CHANNELS.tabGetAll);
    ipcMain.removeAllListeners(IPC_CHANNELS.tabDuplicate);
    ipcMain.removeAllListeners(IPC_CHANNELS.tabMute);
    ipcMain.removeAllListeners(IPC_CHANNELS.tabPin);

    this.logger.info('TabHandler: Handlers unregistered');
  }
}
