/**
 * Services Export Module
 *
 * 모든 서비스를 한 곳에서 내보냅니다.
 * 서비스는 비즈니스 로직을 담당합니다.
 */

import { TabService } from './TabService';
import { HistoryService } from './HistoryService';
import { BookmarkService } from './BookmarkService';
import { WindowService } from './WindowService';
import { TabManager } from '../managers/TabManager';
import { HistoryManager } from '../managers/HistoryManager';
import { ResourceManager } from '../managers/ResourceManager';
import { WindowManager } from '../core/window';
import { DatabaseService } from './database/DatabaseService';

export { TabService } from './TabService';
export { HistoryService } from './HistoryService';
export { BookmarkService } from './BookmarkService';
export { WindowService } from './WindowService';

/**
 * 모든 서비스 인스턴스 생성 함수
 * main/index.ts에서 호출되어 의존성 주입됩니다.
 */
export function initializeAllServices(
  tabManager: TabManager,
  historyManager: HistoryManager,
  resourceManager: ResourceManager,
  windowManager: WindowManager,
  databaseService: DatabaseService
) {
  const tabService = new TabService(tabManager, resourceManager);
  const historyService = new HistoryService(historyManager);
  const bookmarkService = BookmarkService.create(databaseService.getBookmarkRepository());
  const windowService = new WindowService(windowManager);

  return {
    tabService,
    historyService,
    bookmarkService,
    windowService,
  };
}

