/**
 * TabService - 탭 비즈니스 로직
 *
 * 책임: 탭 관리 로직
 * - 탭 생성, 삭제, 선택
 * - 탭 정보 업데이트
 * - 탭 복제
 * - 메모리 모니터링
 *
 * SRP 원칙: 탭 관련 비즈니스 로직만 담당
 * 탭 상태 저장은 TabManager에 위임
 */

import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';
import type { BrowserTab } from '../../shared/types/domain';
import type { TabManager } from '../managers/TabManager';
import type { ResourceManager } from '../managers/ResourceManager';

/**
 * 탭 서비스
 */
export class TabService {
  private logger: ILogger;
  private readonly TAB_MEMORY_LIMIT = 500; // MB

  constructor(
    private tabManager: TabManager,
    private resourceManager: ResourceManager
  ) {
    this.logger = new LoggerImpl('TabService', LogLevel.INFO);
  }

  /**
   * 새 탭 생성
   */
  public async createTab(url: string, title: string = ''): Promise<BrowserTab> {
    try {
      // 메모리 체크
      if (!this.resourceManager.canAllocate(40)) {
        this.logger.error('TabService: Insufficient memory to create tab');
        throw new Error('메모리 부족: 탭을 생성할 수 없습니다');
      }

      this.logger.info('TabService: Creating tab', {
        module: 'TabService',
        metadata: { url, title },
      });

      const createdTab = await this.tabManager.addTab(url, title || url);
      if (!createdTab) {
        throw new Error('탭 생성 실패');
      }

      this.logger.info('TabService: Tab created successfully', {
        module: 'TabService',
        metadata: { tabId: createdTab.id },
      });

      return createdTab;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabService: Failed to create tab', err);
      throw err;
    }
  }

  /**
   * 탭 닫기
   */
  public async closeTab(tabId: string): Promise<void> {
    try {
      this.logger.info('TabService: Closing tab', {
        module: 'TabService',
        metadata: { tabId },
      });

      const success = await this.tabManager.removeTab(tabId);
      if (!success) {
        throw new Error(`탭을 찾을 수 없습니다: ${tabId}`);
      }

      this.logger.info('TabService: Tab closed successfully', {
        module: 'TabService',
        metadata: { tabId },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabService: Failed to close tab', err);
      throw err;
    }
  }

  /**
   * 탭 선택
   */
  public async selectTab(tabId: string): Promise<void> {
    try {
      this.logger.info('TabService: Selecting tab', {
        module: 'TabService',
        metadata: { tabId },
      });

      const tab = await this.tabManager.getTab(tabId);
      if (!tab) {
        throw new Error(`탭을 찾을 수 없습니다: ${tabId}`);
      }

      await this.tabManager.setActiveTab(tabId);

      this.logger.info('TabService: Tab selected successfully', {
        module: 'TabService',
        metadata: { tabId },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabService: Failed to select tab', err);
      throw err;
    }
  }

  /**
   * 탭 정보 업데이트
   */
  public async updateTab(tabId: string, updates: Partial<Omit<BrowserTab, 'id' | 'createdAt'>>): Promise<BrowserTab> {
    try {
      this.logger.info('TabService: Updating tab', {
        module: 'TabService',
        metadata: { tabId, updates },
      });

      const tab = await this.tabManager.getTab(tabId);
      if (!tab) {
        throw new Error(`탭을 찾을 수 없습니다: ${tabId}`);
      }

      await this.tabManager.updateTab(tabId, updates);
      const updatedTab = await this.tabManager.getTab(tabId);
      
      if (!updatedTab) {
        throw new Error('탭 업데이트 실패');
      }

      this.logger.info('TabService: Tab updated successfully', {
        module: 'TabService',
        metadata: { tabId },
      });

      return updatedTab;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabService: Failed to update tab', err);
      throw err;
    }
  }

  /**
   * 모든 탭 조회
   */
  public async getAllTabs(): Promise<BrowserTab[]> {
    try {
      this.logger.info('TabService: Getting all tabs');

      const tabs = await this.tabManager.getAllTabs();
      return tabs;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabService: Failed to get all tabs', err);
      throw err;
    }
  }

  /**
   * 탭 복제
   */
  public async duplicateTab(tabId: string): Promise<BrowserTab> {
    try {
      this.logger.info('TabService: Duplicating tab', {
        module: 'TabService',
        metadata: { tabId },
      });

      const originalTab = await this.tabManager.getTab(tabId);
      if (!originalTab) {
        throw new Error(`탭을 찾을 수 없습니다: ${tabId}`);
      }

      // 메모리 체크
      if (!this.resourceManager.canAllocate(40)) {
        this.logger.error('TabService: Insufficient memory to duplicate tab');
        throw new Error('메모리 부족: 탭을 복제할 수 없습니다');
      }

      const duplicatedTab = await this.tabManager.addTab(originalTab.url, originalTab.title);
      if (!duplicatedTab) {
        throw new Error('탭 복제 실패');
      }

      this.logger.info('TabService: Tab duplicated successfully', {
        module: 'TabService',
        metadata: { originalTabId: tabId, newTabId: duplicatedTab.id },
      });

      return duplicatedTab;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabService: Failed to duplicate tab', err);
      throw err;
    }
  }

  /**
   * 활성 탭 조회
   */
  public async getActiveTab(): Promise<BrowserTab | null> {
    try {
      const activeTab = await this.tabManager.getActiveTab();
      return activeTab ?? null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabService: Failed to get active tab', err);
      throw err;
    }
  }

  /**
   * 탭 개수 조회
   */
  public async getTabCount(): Promise<number> {
    try {
      return await this.tabManager.getTabCount();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabService: Failed to get tab count', err);
      throw err;
    }
  }

  /**
   * 메모리 사용량 체크
   */
  public async checkMemoryUsage(): Promise<boolean> {
    try {
      const tabs = await this.tabManager.getAllTabs();
      const MEMORY_PER_TAB_MB = 40;
      const memoryUsage = tabs.length * MEMORY_PER_TAB_MB;
      const isCritical = memoryUsage > this.TAB_MEMORY_LIMIT;

      if (isCritical) {
        this.logger.warn('TabService: Tab memory usage is critical', {
          module: 'TabService',
          metadata: { memoryUsage, limit: this.TAB_MEMORY_LIMIT },
        });
      }

      return !isCritical;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabService: Failed to check memory usage', err);
      throw err;
    }
  }

  /**
   * 탭 음소거
   */
  public async muteTab(tabId: string): Promise<void> {
    try {
      this.logger.info('TabService: Muting tab', {
        module: 'TabService',
        metadata: { tabId },
      });

      // TabManager에서 탭을 찾아 음소거 상태 업데이트
      // 현재 구현에서는 탭 정보 업데이트로 처리
      const tab = await this.tabManager.getTab(tabId);
      if (!tab) {
        throw new Error(`탭을 찾을 수 없습니다: ${tabId}`);
      }

      await this.tabManager.updateTab(tabId, { isMuted: true });

      this.logger.info('TabService: Tab muted successfully', {
        module: 'TabService',
        metadata: { tabId },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabService: Failed to mute tab', err);
      throw err;
    }
  }

  /**
   * 탭 고정
   */
  public async pinTab(tabId: string): Promise<void> {
    try {
      this.logger.info('TabService: Pinning tab', {
        module: 'TabService',
        metadata: { tabId },
      });

      // TabManager에서 탭을 찾아 고정 상태 업데이트
      const tab = await this.tabManager.getTab(tabId);
      if (!tab) {
        throw new Error(`탭을 찾을 수 없습니다: ${tabId}`);
      }

      await this.tabManager.updateTab(tabId, { isPinned: true });

      this.logger.info('TabService: Tab pinned successfully', {
        module: 'TabService',
        metadata: { tabId },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('TabService: Failed to pin tab', err);
      throw err;
    }
  }
}
