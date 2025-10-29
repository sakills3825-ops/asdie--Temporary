/**
 * HistoryService - 방문 기록 비즈니스 로직
 *
 * 책임: 방문 기록 관리 로직
 * - 기록 추가, 검색, 조회
 * - 기록 삭제, 초기화
 * - 기록 필터링
 *
 * SRP 원칙: 기록 관련 비즈니스 로직만 담당
 * 기록 상태 저장은 HistoryManager에 위임
 */

import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';
import type { HistoryManager } from '../managers/HistoryManager';
import type { HistoryEntry, FrequentSite } from '../../shared/types/domain';

/**
 * 방문 기록 서비스
 */
export class HistoryService {
  private logger: ILogger;

  constructor(private historyManager: HistoryManager) {
    this.logger = new LoggerImpl('HistoryService', LogLevel.INFO);
  }

  /**
   * 방문 기록 항목 추가
   */
  public async addEntry(entry: Omit<HistoryEntry, 'id'>): Promise<HistoryEntry> {
    try {
      this.logger.info('HistoryService: Adding history entry', {
        module: 'HistoryService',
        metadata: { url: entry.url },
      });

      // ID 생성
      const newEntry: HistoryEntry = {
        id: `history_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        ...entry,
      };

      this.historyManager.addEntry(newEntry);

      this.logger.info('HistoryService: History entry added successfully', {
        module: 'HistoryService',
        metadata: { entryId: newEntry.id },
      });

      return newEntry;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryService: Failed to add history entry', err);
      throw err;
    }
  }

  /**
   * 모든 기록 조회
   */
  public async getAllHistory(limit: number = 100): Promise<HistoryEntry[]> {
    try {
      this.logger.info('HistoryService: Getting all history', {
        module: 'HistoryService',
        metadata: { limit },
      });

      const entries = this.historyManager.getAllEntries(limit);
      return entries;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryService: Failed to get all history', err);
      throw err;
    }
  }

  /**
   * 기록 검색
   */
  public async searchHistory(query: string, limit: number = 50): Promise<HistoryEntry[]> {
    try {
      if (!query || query.trim().length === 0) {
        throw new Error('검색어를 입력해주세요');
      }

      this.logger.info('HistoryService: Searching history', {
        module: 'HistoryService',
        metadata: { query, limit },
      });

      const results = await this.historyManager.search(query, limit);

      this.logger.info('HistoryService: History search completed', {
        module: 'HistoryService',
        metadata: { resultCount: results.length },
      });

      return results;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryService: Failed to search history', err);
      throw err;
    }
  }

  /**
   * 특정 기록 조회
   */
  public async getEntry(id: string): Promise<HistoryEntry | null> {
    try {
      const entry = this.historyManager.getEntry(id);
      return entry ?? null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryService: Failed to get entry', err);
      throw err;
    }
  }

  /**
   * 특정 기록 삭제
   */
  public async deleteEntry(id: string): Promise<void> {
    try {
      this.logger.info('HistoryService: Deleting history entry', {
        module: 'HistoryService',
        metadata: { entryId: id },
      });

      const success = this.historyManager.removeEntry(id);
      if (!success) {
        throw new Error(`기록을 찾을 수 없습니다: ${id}`);
      }

      this.logger.info('HistoryService: History entry deleted successfully', {
        module: 'HistoryService',
        metadata: { entryId: id },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryService: Failed to delete history entry', err);
      throw err;
    }
  }

  /**
   * 기록 전체 삭제
   * @param beforeTime - 이 시간 이전의 기록만 삭제 (기본값: 전체)
   */
  public async clearHistory(beforeTime?: number): Promise<void> {
    try {
      this.logger.info('HistoryService: Clearing history', {
        module: 'HistoryService',
        metadata: { beforeTime },
      });

      if (beforeTime) {
        this.historyManager.clearBefore(beforeTime);
      } else {
        this.historyManager.clearAll();
      }

      this.logger.info('HistoryService: History cleared successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryService: Failed to clear history', err);
      throw err;
    }
  }

  /**
   * 날짜 범위로 기록 조회
   */
  public async getByDateRange(start: number, end: number): Promise<HistoryEntry[]> {
    try {
      if (start > end) {
        throw new Error('시작 날짜가 종료 날짜보다 클 수 없습니다');
      }

      this.logger.info('HistoryService: Getting history by date range', {
        module: 'HistoryService',
        metadata: { start, end },
      });

      const entries = this.historyManager.getEntriesByDateRange(start, end);
      return entries;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryService: Failed to get history by date range', err);
      throw err;
    }
  }

  /**
   * 자주 방문한 사이트 조회
   */
  public async getFrequentSites(limit: number = 10): Promise<FrequentSite[]> {
    try {
      this.logger.info('HistoryService: Getting frequent sites', {
        module: 'HistoryService',
        metadata: { limit },
      });

      const sites = await this.historyManager.getFrequentSites(limit);
      return sites;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryService: Failed to get frequent sites', err);
      throw err;
    }
  }

  /**
   * 기록 개수 조회
   */
  public async getCount(): Promise<number> {
    try {
      return this.historyManager.getCount();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryService: Failed to get count', err);
      throw err;
    }
  }

  /**
   * 기록 메모리 사용량 조회
   * 
   * @deprecated 데이터베이스 기반 시스템에서는 더 이상 메모리 사용량을 반환하지 않습니다.
   */
  public async getMemoryUsage(): Promise<number> {
    try {
      const count = await this.historyManager.getCount();
      // 데이터베이스 기반이므로 메모리 사용량 대신 레코드 수를 반환
      return count * 100; // 대략적인 추정값
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryService: Failed to get memory usage', err);
      throw err;
    }
  }
}
