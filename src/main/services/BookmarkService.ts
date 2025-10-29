/**
 * BookmarkService - 북마크 비즈니스 로직 (aside.db 기반)
 *
 * 책임: 북마크 관리 로직
 * - 북마크 추가, 삭제, 조회 (BookmarkRepository)
 * - 폴더 관리
 * - 북마크 검색
 *
 * SRP 원칙: 북마크 관련 비즈니스 로직만 담당
 * 북마크 데이터 저장은 BookmarkRepository에 위임
 */

import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';
import type { Bookmark } from '../../shared/types/domain';
import { BookmarkRepository } from './database/BookmarkRepository';

/**
 * 북마크 서비스 (DB 기반)
 */
export class BookmarkService {
  private logger: ILogger;
  private bookmarkRepository: BookmarkRepository;

  private constructor(bookmarkRepository: BookmarkRepository) {
    this.logger = new LoggerImpl('BookmarkService', LogLevel.INFO);
    this.bookmarkRepository = bookmarkRepository;
  }

  /**
   * BookmarkService 생성 (의존성 주입)
   */
  static create(bookmarkRepository: BookmarkRepository): BookmarkService {
    return new BookmarkService(bookmarkRepository);
  }

  /**
   * 북마크 추가
   */
  public async createBookmark(bookmark: { url: string; title: string; folder?: string | undefined; tags?: string[] | undefined }): Promise<Bookmark> {
    try {
      this.logger.info('BookmarkService: Creating bookmark', {
        module: 'BookmarkService',
        metadata: { title: bookmark.title },
      });

      const newBookmark = await this.bookmarkRepository.create({
        url: bookmark.url || '',
        title: bookmark.title || 'Untitled',
        description: '',
        folder: bookmark.folder || 'default',
        favicon: null
      });

      this.logger.info('BookmarkService: Bookmark created successfully', {
        module: 'BookmarkService',
        metadata: { bookmarkId: newBookmark.id },
      });

      return newBookmark;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkService: Failed to create bookmark', err);
      throw err;
    }
  }

  /**
   * 북마크 삭제
   */
  public async deleteBookmark(id: string): Promise<void> {
    try {
      this.logger.info('BookmarkService: Deleting bookmark', {
        module: 'BookmarkService',
        metadata: { bookmarkId: id },
      });

      await this.bookmarkRepository.delete(id);

      this.logger.info('BookmarkService: Bookmark deleted successfully', {
        module: 'BookmarkService',
        metadata: { bookmarkId: id },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkService: Failed to delete bookmark', err);
      throw err;
    }
  }

  /**
   * 모든 북마크 조회
   */
  public async getAllBookmarks(): Promise<Bookmark[]> {
    try {
      this.logger.info('BookmarkService: Getting all bookmarks');

      const bookmarks = await this.bookmarkRepository.findAll();
      return bookmarks;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkService: Failed to get all bookmarks', err);
      throw err;
    }
  }

  /**
   * 북마크 폴더 조회
   */
  public async getBookmarkFolders(): Promise<Array<{ id: string; name: string }>> {
    try {
      this.logger.info('BookmarkService: Getting bookmark folders');

      const folders = await this.bookmarkRepository.getFolders();

      // string[]을 { id, name } 객체 배열로 변환
      return folders.map((folder, index) => ({
        id: `folder-${index}`,
        name: folder
      }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkService: Failed to get bookmark folders', err);
      throw err;
    }
  }

  /**
   * 북마크 폴더 생성
   */
  public async addFolder(folderName: string): Promise<{ id: string; name: string }> {
    try {
      if (!folderName || folderName.trim().length === 0) {
        throw new Error('폴더 이름을 입력해주세요');
      }

      this.logger.info('BookmarkService: Adding folder', {
        module: 'BookmarkService',
        metadata: { folderName },
      });

      // 폴더는 Prisma의 distinct API를 사용하여 생성
      // 실제로는 북마크의 folder 필드에 저장되므로 여기서는 메타데이터로 관리
      const folderId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      this.logger.info('BookmarkService: Folder added successfully', {
        module: 'BookmarkService',
        metadata: { folderId },
      });

      return { id: folderId, name: folderName.trim() };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkService: Failed to add folder', err);
      throw err;
    }
  }

  /**
   * 북마크 폴더 삭제
   */
  public async deleteFolder(folderId: string): Promise<void> {
    try {
      this.logger.info('BookmarkService: Deleting folder', {
        module: 'BookmarkService',
        metadata: { folderId },
      });

      // 폴더의 북마크들을 삭제
      await this.bookmarkRepository.deleteByFolder(folderId);

      this.logger.info('BookmarkService: Folder deleted successfully', {
        module: 'BookmarkService',
        metadata: { folderId },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkService: Failed to delete folder', err);
      throw err;
    }
  }

  /**
   * 북마크 검색
   */
  public async searchBookmarks(query: string): Promise<Bookmark[]> {
    try {
      if (!query || query.trim().length === 0) {
        throw new Error('검색어를 입력해주세요');
      }

      this.logger.info('BookmarkService: Searching bookmarks', {
        module: 'BookmarkService',
        metadata: { query },
      });

      const results = await this.bookmarkRepository.search(query);

      this.logger.info('BookmarkService: Bookmark search completed', {
        module: 'BookmarkService',
        metadata: { resultCount: results.length },
      });

      return results;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkService: Failed to search bookmarks', err);
      throw err;
    }
  }

  /**
   * 북마크 업데이트
   */
  public async updateBookmark(
    id: string, 
    updates: Partial<Omit<Bookmark, 'id' | 'createdAt'>> & { folder?: string | undefined; tags?: string[] | undefined }
  ): Promise<Bookmark> {
    try {
      this.logger.info('BookmarkService: Updating bookmark', {
        module: 'BookmarkService',
        metadata: { bookmarkId: id },
      });

      const updatedBookmark = await this.bookmarkRepository.update(id, updates);

      this.logger.info('BookmarkService: Bookmark updated successfully', {
        module: 'BookmarkService',
        metadata: { bookmarkId: id },
      });

      return updatedBookmark;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkService: Failed to update bookmark', err);
      throw err;
    }
  }

  /**
   * 특정 북마크 조회
   */
  public async getBookmark(id: string): Promise<Bookmark | null> {
    try {
      const bookmark = await this.bookmarkRepository.findById(id);
      return bookmark ?? null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkService: Failed to get bookmark', err);
      throw err;
    }
  }

  /**
   * 북마크 개수 조회
   */
  public async getCount(): Promise<number> {
    try {
      return await this.bookmarkRepository.count();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkService: Failed to get count', err);
      throw err;
    }
  }

  /**
   * 폴더 이름 변경
   */
  public async updateFolder(folderId: string, newName: string): Promise<{ id: string; name: string }> {
    try {
      this.logger.info('BookmarkService: Updating folder', {
        module: 'BookmarkService',
        metadata: { folderId, newName },
      });

      // 해당 폴더의 모든 북마크를 새 폴더명으로 업데이트
      const bookmarks = await this.bookmarkRepository.findByFolder(folderId);
      
      for (const bookmark of bookmarks) {
        await this.bookmarkRepository.update(bookmark.id, {
          ...bookmark,
          folder: newName
        });
      }

      this.logger.info('BookmarkService: Folder updated successfully', {
        module: 'BookmarkService',
        metadata: { folderId, newName },
      });

      return { id: folderId, name: newName };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('BookmarkService: Failed to update folder', err);
      throw err;
    }
  }
}
