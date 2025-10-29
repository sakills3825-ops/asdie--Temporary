/**
 * Handlers Export Module
 *
 * 모든 핸들러를 한 곳에서 내보냅니다.
 * 핸들러는 IPC 요청을 받아서 서비스로 라우팅하는 역할을 합니다.
 */

export { TabHandler, type ITabService } from './TabHandler';
export { HistoryHandler, type IHistoryService } from './HistoryHandler';
export { BookmarkHandler, type IBookmarkService } from './BookmarkHandler';
export { WindowHandler, type IWindowService } from './WindowHandler';

import { TabHandler } from './TabHandler';
import { HistoryHandler } from './HistoryHandler';
import { BookmarkHandler } from './BookmarkHandler';
import { WindowHandler } from './WindowHandler';
import type { ITabService } from './TabHandler';
import type { IHistoryService } from './HistoryHandler';
import type { IBookmarkService } from './BookmarkHandler';
import type { IWindowService } from './WindowHandler';

/**
 * 모든 핸들러 등록 함수
 * 이 함수는 main/index.ts에서 호출됩니다.
 * 각 핸들러가 IPC 채널을 등록합니다.
 */
export function registerAllHandlers(
  tabService: ITabService,
  historyService: IHistoryService,
  bookmarkService: IBookmarkService,
  windowService: IWindowService
) {
  const tabHandler = new TabHandler(tabService);
  const historyHandler = new HistoryHandler(historyService);
  const bookmarkHandler = new BookmarkHandler(bookmarkService);
  const windowHandler = new WindowHandler(windowService);

  tabHandler.registerHandlers();
  historyHandler.registerHandlers();
  bookmarkHandler.registerHandlers();
  windowHandler.registerHandlers();

  return {
    tabHandler,
    historyHandler,
    bookmarkHandler,
    windowHandler,
  };
}
