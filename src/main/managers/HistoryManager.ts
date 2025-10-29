/**
 * HistoryManager - 방문 기록 저장소
 *
 * 책임: 방문 기록 관리
 * - 히스토리 추가/삭제/조회 (aside.db 기반)
 * - 검색 및 필터링
 * - 최근 항목 우선 조회
 *
 * Phase 1: Prisma Repository 기반 데이터 영속성
 * Phase 2: 메모리 캐싱 (선택사항)
 *
 * SRP 원칙: 비즈니스 로직만 담당
 * 데이터 접근은 HistoryRepository에 위임
 */

import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';
import { HistoryRepository } from '../services/database/HistoryRepository';

/**
 * 히스토리 저장소 (aside.db 기반)
 */
export class HistoryManager {
  private logger: ILogger;
  private historyRepository: HistoryRepository;

  private constructor(historyRepository: HistoryRepository) {
    this.logger = new LoggerImpl('HistoryManager', LogLevel.INFO);
    this.historyRepository = historyRepository;
  }

  /**
   * HistoryManager 생성 (의존성 주입)
   */
  static create(historyRepository: HistoryRepository): HistoryManager {
    return new HistoryManager(historyRepository);
  }

  /**
   * 히스토리 항목 추가
   *
   * @param entry 추가할 히스토리 항목
   */
  public async addEntry(entry: any): Promise<void> {
    try {
      const visitedDate = entry.visitedAt instanceof Date 
        ? entry.visitedAt 
        : new Date(entry.visitedAt || Date.now());

      await this.historyRepository.create({
        url: entry.url,
        title: entry.title || '',
        visitedAt: visitedDate,
        duration: entry.duration || 0,
        favicon: entry.favicon || null,
        visits: entry.visits || 1
      });

      this.logger.info('HistoryManager: Entry added', {
        module: 'HistoryManager',
        metadata: { url: entry.url },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryManager: Failed to add entry', err);
      throw error;
    }
  }

  /**
   * 모든 히스토리 조회 (최신순)
   *
   * @param limit 반환할 최대 항목 수
   * @returns 히스토리 항목 배열
   */
  public async getAllEntries(limit: number = 100): Promise<any[]> {
    try {
      return await this.historyRepository.findAll(limit);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryManager: Failed to get all entries', err);
      throw error;
    }
  }

  /**
   * 특정 히스토리 항목 조회
   *
   * @param id 항목 ID
   * @returns 히스토리 항목 또는 null
   */
  public async getEntry(id: string): Promise<any | null> {
    try {
      return await this.historyRepository.findById(id);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryManager: Failed to get entry', err);
      throw error;
    }
  }

  /**
   * 히스토리 검색
   *
   * @param query 검색 쿼리 (URL 또는 제목에 포함)
   * @param limit 반환할 최대 항목 수
   * @returns 검색 결과
   */
  public async search(query: string, limit: number = 50): Promise<any[]> {
    try {
      return await this.historyRepository.search(query, limit);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryManager: Failed to search', err);
      throw error;
    }
  }

  /**
   * 히스토리 항목 삭제
   *
   * @param id 삭제할 항목 ID
   * @returns 성공 여부
   */
  public async removeEntry(id: string): Promise<boolean> {
    try {
      await this.historyRepository.delete(id);
      this.logger.info('HistoryManager: Entry removed', {
        module: 'HistoryManager',
        metadata: { id },
      });
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryManager: Failed to remove entry', err);
      return false;
    }
  }

  /**
   * 날짜 범위로 히스토리 조회
   *
   * @param startTime 시작 시간 (ms)
   * @param endTime 종료 시간 (ms)
   * @returns 해당 범위의 히스토리
   */
  public async getEntriesByDateRange(startTime: number, endTime: number): Promise<any[]> {
    try {
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      return await this.historyRepository.findByDateRange(startDate, endDate);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryManager: Failed to get entries by date range', err);
      throw error;
    }
  }

  /**
   * 자주 방문한 사이트 조회
   *
   * @param limit 반환할 사이트 개수
   * @returns 방문 빈도순 사이트
   */
  public async getFrequentSites(limit: number = 10): Promise<any[]> {
    try {
      return await this.historyRepository.getFrequentSites(limit);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryManager: Failed to get frequent sites', err);
      throw error;
    }
  }

  /**
   * 모든 히스토리 제거
   */
  public async clearAll(): Promise<void> {
    try {
      await this.historyRepository.deleteAll();
      this.logger.info('HistoryManager: All entries cleared');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryManager: Failed to clear all entries', err);
      throw error;
    }
  }

  /**
   * 특정 시간 이전의 히스토리 제거
   *
   * @param beforeTime 이 시간 이전의 항목을 제거 (ms)
   * @returns 제거된 항목 수
   */
  public async clearBefore(beforeTime: number): Promise<number> {
    try {
      const beforeDate = new Date(beforeTime);
      const result = await this.historyRepository.deleteBeforeTime(beforeDate);
      return result.count;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryManager: Failed to clear before time', err);
      throw error;
    }
  }

  /**
   * 히스토리 항목 수 조회
   *
   * @returns 항목 수
   */
  public async getCount(): Promise<number> {
    try {
      return await this.historyRepository.count();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('HistoryManager: Failed to get count', err);
      throw error;
    }
  }
}
