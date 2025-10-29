/**
 * TabManager - 탭 상태 저장소 (aside.db 기반)
 *
 * 책임: 활성 탭의 상태를 데이터베이스에 저장/조회
 * - 탭 CRUD (DatabaseService → TabRepository)
 * - 활성 탭 관리
 *
 * SRP 원칙: 상태 저장소만 담당
 * 비즈니스 로직은 TabService에, IPC 처리는 TabHandler에 위임
 */

import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';
import type { BrowserTab } from '../../shared/types/domain';
import { TabRepository } from '../services/database/TabRepository';

/**
 * 탭 상태 저장소 (DB 기반)
 */
export class TabManager {
  private logger: ILogger;
  private tabRepository: TabRepository;

  private constructor(tabRepository: TabRepository) {
    this.logger = new LoggerImpl('TabManager', LogLevel.INFO);
    this.tabRepository = tabRepository;
  }

  /**
   * TabManager 생성 (의존성 주입)
   */
  static create(tabRepository: TabRepository): TabManager {
    return new TabManager(tabRepository);
  }

  /**
   * 새 탭 추가
   *
   * @param url 탭의 URL
   * @param title 탭의 제목
   * @returns 생성된 탭
   */
  public async addTab(url: string, title?: string): Promise<BrowserTab> {
    try {
      const tab = await this.tabRepository.create({
        url,
        title: title ?? 'New Tab',
        isActive: false
      });

      this.logger.info('TabManager: Tab added', {
        module: 'TabManager',
        metadata: { tabId: tab.id, url: tab.url },
      });

      return tab;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabManager: Failed to add tab', err);
      throw error;
    }
  }

  /**
   * 탭 제거
   *
   * @param tabId 제거할 탭 ID
   * @returns 성공 여부
   */
  public async removeTab(tabId: string): Promise<boolean> {
    try {
      const deleted = await this.tabRepository.delete(tabId);
      
      this.logger.info('TabManager: Tab removed', {
        module: 'TabManager',
        metadata: { tabId },
      });
      
      return !!deleted;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabManager: Failed to remove tab', err);
      throw error;
    }
  }

  /**
   * 탭 조회
   *
   * @param tabId 조회할 탭 ID
   * @returns 탭 또는 null
   */
  public async getTab(tabId: string): Promise<BrowserTab | null> {
    try {
      return await this.tabRepository.findById(tabId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabManager: Failed to get tab', err);
      throw error;
    }
  }

  /**
   * 모든 탭 조회
   *
   * @returns 탭 배열
   */
  public async getAllTabs(): Promise<BrowserTab[]> {
    try {
      return await this.tabRepository.findAll();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabManager: Failed to get all tabs', err);
      throw error;
    }
  }

  /**
   * 탭 정보 업데이트
   *
   * @param tabId 탭 ID
   * @param updates 업데이트할 필드
   * @returns 성공 여부
   */
  public async updateTab(
    tabId: string,
    updates: Partial<Omit<BrowserTab, 'id' | 'createdAt'>>
  ): Promise<boolean> {
    try {
      const updated = await this.tabRepository.update(tabId, updates);

      this.logger.info('TabManager: Tab updated', {
        module: 'TabManager',
        metadata: { tabId },
      });

      return !!updated;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabManager: Failed to update tab', err);
      throw error;
    }
  }

  /**
   * 활성 탭 설정
   *
   * @param tabId 활성화할 탭 ID
   * @returns 성공 여부
   */
  public async setActiveTab(tabId: string): Promise<boolean> {
    try {
      await this.tabRepository.setActive(tabId);

      this.logger.info('TabManager: Active tab set', {
        module: 'TabManager',
        metadata: { tabId },
      });

      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabManager: Failed to set active tab', err);
      throw error;
    }
  }

  /**
   * 활성 탭 조회
   *
   * @returns 활성 탭 또는 null
   */
  public async getActiveTab(): Promise<BrowserTab | null> {
    try {
      const tabs = await this.tabRepository.findAll();
      return tabs.find((tab: BrowserTab) => tab.isActive) ?? null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabManager: Failed to get active tab', err);
      throw error;
    }
  }

  /**
   * 활성 탭 ID 조회
   *
   * @returns 활성 탭 ID 또는 null
   */
  public async getActiveTabId(): Promise<string | null> {
    try {
      const activeTab = await this.getActiveTab();
      return activeTab?.id ?? null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabManager: Failed to get active tab ID', err);
      throw error;
    }
  }

  /**
   * 탭 개수 조회
   *
   * @returns 탭 개수
   */
  public async getTabCount(): Promise<number> {
    try {
      const tabs = await this.tabRepository.findAll();
      return tabs.length;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabManager: Failed to get tab count', err);
      throw error;
    }
  }

  /**
   * URL로 탭 찾기
   *
   * @param url 탭 URL
   * @returns 탭 또는 null
   */
  public async getTabByUrl(url: string): Promise<BrowserTab | null> {
    try {
      return await this.tabRepository.findByUrl(url);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabManager: Failed to get tab by URL', err);
      throw error;
    }
  }

  /**
   * 모든 탭 제거
   */
  public async clearAllTabs(): Promise<void> {
    try {
      await this.tabRepository.deleteAll();
      this.logger.info('TabManager: All tabs cleared');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabManager: Failed to clear all tabs', err);
      throw error;
    }
  }
}
