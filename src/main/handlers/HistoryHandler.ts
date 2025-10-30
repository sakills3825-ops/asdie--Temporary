/**
 * HistoryHandler - 방문 기록 IPC 핸들러
 *
 * 책임: IPC 요청을 받아서 HistoryService로 라우팅
 * - history:add
 * - history:search
 * - history:getAll
 * - history:delete
 * - history:clear
 * - history:getByDateRange
 * - history:getFrequentSites
 *
 * SRP 원칙: IPC 요청 처리와 라우팅만 담당
 * 비즈니스 로직은 HistoryService에 위임
 */

import { ipcMain } from 'electron';
import { BaseHandler } from './BaseHandler';
import type { HistoryEntry, FrequentSite } from '../../shared/types/domain';
import { IPC_CHANNELS } from '../../shared/ipc/channels';
import {
  HistoryEntrySchema,
  HistorySearchRequestSchema,
  HistoryIdRequestSchema,
} from '../../shared/ipc/validators';
import { validateSearchQueryWithError } from './InputValidator';

/**
 * HistoryService 인터페이스 (Phase 4에서 구현)
 */
export interface IHistoryService {
  addEntry(entry: Omit<HistoryEntry, 'id'>): Promise<HistoryEntry>;
  searchHistory(query: string, limit?: number): Promise<HistoryEntry[]>;
  getAllHistory(limit?: number): Promise<HistoryEntry[]>;
  deleteEntry(id: string): Promise<void>;
  clearHistory(beforeTime?: number): Promise<void>;
  getByDateRange(start: number, end: number): Promise<HistoryEntry[]>;
  getFrequentSites(limit?: number): Promise<FrequentSite[]>;
}

/**
 * 방문 기록 IPC 핸들러
 */
export class HistoryHandler extends BaseHandler {
  constructor(private historyService: IHistoryService) {
    super('HistoryHandler');
  }

  /**
   * 모든 방문 기록 IPC 핸들 등록
   */
  public registerHandlers(): void {
    this.logger.info('HistoryHandler: Registering handlers');

    // 기록 추가
    ipcMain.handle(IPC_CHANNELS.historyAdd, (_event, entry: HistoryEntry) => this.handleAddEntry(entry));

    // 기록 검색
    ipcMain.handle(IPC_CHANNELS.historySearch, (_event, query: string, limit?: number) =>
      this.handleSearchHistory(query, limit)
    );

    // 모든 기록 조회
    ipcMain.handle(IPC_CHANNELS.historyGetAll, (_event, limit?: number) =>
      this.handleGetAllHistory(limit)
    );

    // 기록 삭제
    ipcMain.handle(IPC_CHANNELS.historyDelete, (_event, id: string) => this.handleDeleteEntry(id));

    // 기록 전체 삭제
    ipcMain.handle(IPC_CHANNELS.historyClear, (_event, beforeTime?: number) =>
      this.handleClearHistory(beforeTime)
    );

    // 날짜 범위로 조회
    // ipcMain.handle(IPC_CHANNELS.historyGetByDateRange, (_event, start: number, end: number) =>
    //   this.handleGetByDateRange(start, end)
    // );

    // 자주 방문한 사이트
    // ipcMain.handle(IPC_CHANNELS.historyGetFrequentSites, (_event, limit?: number) =>
    //   this.handleGetFrequentSites(limit)
    // );

    this.logger.info('HistoryHandler: Handlers registered successfully');
  }

  // formatErrorResponse is provided by BaseHandler

  /**
   * 기록 추가 핸들러
   */
  private async handleAddEntry(entry: HistoryEntry) {
    try {
      // 입력값 검증
      const validated = HistoryEntrySchema.parse(entry);

      this.logger.info('HistoryHandler: Adding entry', {
        module: 'HistoryHandler',
        metadata: { url: validated.url },
      });

      const result = await this.historyService.addEntry(validated as HistoryEntry);
      return { success: true, data: result };
    } catch (error) {
      return this.formatErrorResponse(error, 'Adding entry');
    }
  }

  /**
   * 기록 검색 검증
   */
  private validateSearchHistoryInput(
    query: string,
    limit?: number
  ): { valid: boolean; error?: string | undefined } {
    // 검색어 검증
    const queryValidation = validateSearchQueryWithError(query);
    if (!queryValidation.valid) {
      return { valid: false, error: queryValidation.error };
    }

    // limit 범위 검증
    if (limit !== undefined && (limit < 1 || limit > 1000)) {
      return { valid: false, error: 'Limit은 1-1000 사이여야 합니다' };
    }

    return { valid: true };
  }

  /**
   * 기록 검색 핸들러
   */
  private async handleSearchHistory(query: string, limit: number = 50) {
    try {
      // 입력값 검증
      const validation = this.validateSearchHistoryInput(query, limit);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Zod 검증
      const validated = HistorySearchRequestSchema.parse({ query, limit });

      this.logger.info('HistoryHandler: Searching history', {
        module: 'HistoryHandler',
        metadata: { query: validated.query, limit: validated.limit },
      });

      const results = await this.historyService.searchHistory(validated.query, validated.limit);
      return { success: true, data: results };
    } catch (error) {
      return this.formatErrorResponse(error, 'Searching history');
    }
  }

  /**
   * 모든 기록 조회 핸들러
   */
  private async handleGetAllHistory(limit: number = 100) {
    try {
      this.logger.info('HistoryHandler: Getting all history', {
        module: 'HistoryHandler',
        metadata: { limit },
      });

      const entries = await this.historyService.getAllHistory(limit);
      return { success: true, data: entries };
    } catch (error) {
      return this.formatErrorResponse(error, 'Getting all history');
    }
  }

  /**
   * 기록 삭제 핸들러
   */
  private async handleDeleteEntry(id: string) {
    try {
      // 입력값 검증
      const validated = HistoryIdRequestSchema.parse({ id });

      this.logger.info('HistoryHandler: Deleting entry', {
        module: 'HistoryHandler',
        metadata: { id: validated.id },
      });

      await this.historyService.deleteEntry(validated.id);
      return { success: true };
    } catch (error) {
      return this.formatErrorResponse(error, 'Deleting entry');
    }
  }

  /**
   * 기록 전체 삭제 핸들러
   */
  private async handleClearHistory(beforeTime?: number) {
    try {
      this.logger.info('HistoryHandler: Clearing history', {
        module: 'HistoryHandler',
        metadata: { beforeTime },
      });

      await this.historyService.clearHistory(beforeTime);
      return { success: true };
    } catch (error) {
      return this.formatErrorResponse(error, 'Clearing history');
    }
  }

  /**
   * 모든 핸들러 등록 해제
   */
  public unregisterHandlers(): void {
    ipcMain.removeAllListeners(IPC_CHANNELS.historyAdd);
    ipcMain.removeAllListeners(IPC_CHANNELS.historySearch);
    ipcMain.removeAllListeners(IPC_CHANNELS.historyGetAll);
    ipcMain.removeAllListeners(IPC_CHANNELS.historyDelete);
    ipcMain.removeAllListeners(IPC_CHANNELS.historyClear);

    this.logger.info('HistoryHandler: Handlers unregistered');
  }
}
