/**
 * BookmarkHandler - 북마크 IPC 핸들러
 *
 * 책임: IPC 요청을 받아서 BookmarkService로 라우팅
 * - bookmark:create
 * - bookmark:delete
 * - bookmark:getAll
 * - bookmark:getFolders
 * - bookmark:addFolder
 * - bookmark:deleteFolder
 * - bookmark:search
 * - bookmark:update
 *
 * SRP 원칙: IPC 요청 처리와 라우팅만 담당
 * 비즈니스 로직은 BookmarkService에 위임
 */

import { ipcMain } from 'electron';
import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';
import { IPC_CHANNELS } from '../../shared/ipc/channels';
import type { Bookmark } from '../../shared/types';
import {
  BookmarkCreateRequestSchema,
  BookmarkIdRequestSchema,
  BookmarkFolderRequestSchema,
  BookmarkSearchRequestSchema,
} from '../../shared/ipc/validators';

/**
 * 북마크 생성 요청 타입
 */
export interface CreateBookmarkRequest {
  url: string;
  title: string;
  folder?: string;
  tags?: string[];
}

/**
 * 북마크 업데이트 요청 타입
 */
export interface UpdateBookmarkRequest {
  url?: string;
  title?: string;
  folder?: string;
  tags?: string[];
}

/**
 * 폴더 타입
 */
export interface BookmarkFolder {
  id: string;
  name: string;
}

/**
 * BookmarkService 인터페이스 (Phase 4에서 구현)
 */
export interface IBookmarkService {
  createBookmark(bookmark: CreateBookmarkRequest): Promise<Bookmark>;
  deleteBookmark(id: string): Promise<void>;
  getAllBookmarks(): Promise<Bookmark[]>;
  getBookmarkFolders(): Promise<BookmarkFolder[]>;
  addFolder(folderName: string): Promise<BookmarkFolder>;
  deleteFolder(folderId: string): Promise<void>;
  updateFolder(folderId: string, newName: string): Promise<BookmarkFolder>;
  searchBookmarks(query: string): Promise<Bookmark[]>;
  updateBookmark(id: string, updates: UpdateBookmarkRequest): Promise<Bookmark>;
}

/**
 * 북마크 IPC 핸들러
 */
export class BookmarkHandler {
  private logger: ILogger;

  constructor(private bookmarkService: IBookmarkService) {
    this.logger = new LoggerImpl('BookmarkHandler', LogLevel.INFO);
  }

  /**
   * 모든 북마크 IPC 핸들 등록
   */
  public registerHandlers(): void {
    this.logger.info('BookmarkHandler: Registering handlers');

    // 북마크 추가
    ipcMain.handle(IPC_CHANNELS.bookmarkAdd, (_event, bookmark: CreateBookmarkRequest) =>
      this.handleCreateBookmark(bookmark)
    );

    // 북마크 삭제
    ipcMain.handle(IPC_CHANNELS.bookmarkRemove, (_event, id: string) =>
      this.handleDeleteBookmark(id)
    );

    // 모든 북마크 조회
    ipcMain.handle(IPC_CHANNELS.bookmarkGetAll, () => this.handleGetAllBookmarks());

    // 폴더 생성
    ipcMain.handle(IPC_CHANNELS.bookmarkCreateFolder, (_event, folderName: string) =>
      this.handleAddFolder(folderName)
    );

    // 폴더 업데이트
    ipcMain.handle(IPC_CHANNELS.bookmarkUpdateFolder, (_event, folderId: string, newName: string) =>
      this.handleUpdateFolder(folderId, newName)
    );

    // 북마크 검색
    ipcMain.handle(IPC_CHANNELS.bookmarkSearch, (_event, query: string) =>
      this.handleSearchBookmarks(query)
    );

    this.logger.info('BookmarkHandler: Handlers registered successfully');
  }

  /**
   * 북마크 생성 핸들러
   */
  private async handleCreateBookmark(bookmark: any) {
    try {
      // 입력값 검증
      const validated = BookmarkCreateRequestSchema.parse(bookmark);

      this.logger.info('BookmarkHandler: Creating bookmark', {
        module: 'BookmarkHandler',
        metadata: { title: validated.title },
      });

      const result = await this.bookmarkService.createBookmark(validated as any);
      return { success: true, data: result };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkHandler: Failed to create bookmark', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * 북마크 삭제 핸들러
   */
  private async handleDeleteBookmark(id: string) {
    try {
      // 입력값 검증
      const validated = BookmarkIdRequestSchema.parse({ id });

      this.logger.info('BookmarkHandler: Deleting bookmark', {
        module: 'BookmarkHandler',
        metadata: { id: validated.id },
      });

      await this.bookmarkService.deleteBookmark(validated.id);
      return { success: true };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkHandler: Failed to delete bookmark', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * 모든 북마크 조회 핸들러
   */
  private async handleGetAllBookmarks() {
    try {
      this.logger.info('BookmarkHandler: Getting all bookmarks');

      const bookmarks = await this.bookmarkService.getAllBookmarks();
      return { success: true, data: bookmarks };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkHandler: Failed to get all bookmarks', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * 폴더 목록 조회 핸들러
   */
  // private async handleGetBookmarkFolders() {
  //   try {
  //     this.logger.info('BookmarkHandler: Getting bookmark folders');
  //
  //     const folders = await this.bookmarkService.getBookmarkFolders();
  //     return { success: true, data: folders };
  //   } catch (error) {
  //     const err = error instanceof Error ? error : new Error(String(error));
  //     this.logger.error('BookmarkHandler: Failed to get bookmark folders', err);
  //     return { success: false, error: err.message };
  //   }
  // }

  /**
   * 폴더 추가 핸들러
   */
  private async handleAddFolder(folderName: string) {
    try {
      // 입력값 검증
      const validated = BookmarkFolderRequestSchema.parse({ folderName });

      this.logger.info('BookmarkHandler: Adding folder', {
        module: 'BookmarkHandler',
        metadata: { folderName: validated.folderName },
      });

      const result = await this.bookmarkService.addFolder(validated.folderName);
      return { success: true, data: result };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkHandler: Failed to add folder', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * 폴더 업데이트 핸들러
   */
  private async handleUpdateFolder(folderId: string, newName: string) {
    try {
      // 입력값 검증
      const validatedId = BookmarkIdRequestSchema.parse({ id: folderId });
      const validatedName = BookmarkFolderRequestSchema.parse({ folderName: newName });

      this.logger.info('BookmarkHandler: Updating folder', {
        module: 'BookmarkHandler',
        metadata: { folderId: validatedId.id, newName: validatedName.folderName },
      });

      const result = await this.bookmarkService.updateFolder(validatedId.id, validatedName.folderName);
      return { success: true, data: result };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkHandler: Failed to update folder', err);
      return { success: false, error: err.message };
    }
  }
  /**
   * 폴더 삭제 핸들러 (현재 사용 안 함)
   */
  // private async handleDeleteFolder(folderId: string) {
  //   try {
  //     this.logger.info('BookmarkHandler: Deleting folder', {
  //       module: 'BookmarkHandler',
  //       metadata: { folderId },
  //     });
  //
  //     await this.bookmarkService.deleteFolder(folderId);
  //     return { success: true };
  //   } catch (error) {
  //     const err = error instanceof Error ? error : new Error(String(error));
  //     this.logger.error('BookmarkHandler: Failed to delete folder', err);
  //     return { success: false, error: err.message };
  //   }
  // }

  /**
   * 북마크 검색 핸들러
   */
  private async handleSearchBookmarks(query: string) {
    try {
      // 입력값 검증
      const validated = BookmarkSearchRequestSchema.parse({ query });

      this.logger.info('BookmarkHandler: Searching bookmarks', {
        module: 'BookmarkHandler',
        metadata: { query: validated.query },
      });

      const results = await this.bookmarkService.searchBookmarks(validated.query);
      return { success: true, data: results };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkHandler: Failed to search bookmarks', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * 모든 핸들러 등록 해제
   */
  public unregisterHandlers(): void {
    ipcMain.removeAllListeners(IPC_CHANNELS.bookmarkAdd);
    ipcMain.removeAllListeners(IPC_CHANNELS.bookmarkRemove);
    ipcMain.removeAllListeners(IPC_CHANNELS.bookmarkGetAll);
    ipcMain.removeAllListeners(IPC_CHANNELS.bookmarkCreateFolder);
    ipcMain.removeAllListeners(IPC_CHANNELS.bookmarkUpdateFolder);
    ipcMain.removeAllListeners(IPC_CHANNELS.bookmarkSearch);

    this.logger.info('BookmarkHandler: Handlers unregistered');
  }
}
