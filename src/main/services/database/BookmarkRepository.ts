/**
 * Bookmark Repository
 * 
 * Prisma를 사용한 Bookmark 데이터 접근 계층
 * - 북마크 CRUD 작업
 * - 폴더별 관리
 * - 태그로 검색
 */

import { PrismaClient, Bookmark } from '@prisma/client';

/**
 * BookmarkRepository 클래스
 * 데이터베이스 접근을 캡슐화
 */
export class BookmarkRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 모든 북마크 조회
   */
  async findAll(): Promise<Bookmark[]> {
    return this.prisma.bookmark.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * ID로 북마크 조회
   */
  async findById(id: string): Promise<Bookmark | null> {
    return this.prisma.bookmark.findUnique({
      where: { id }
    });
  }

  /**
   * 폴더별 북마크 조회
   */
  async findByFolder(folder: string): Promise<Bookmark[]> {
    return this.prisma.bookmark.findMany({
      where: { folder },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * 키워드로 검색 (제목, URL, 설명)
   */
  async search(query: string): Promise<Bookmark[]> {
    return this.prisma.bookmark.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { url: { contains: query } },
          { description: { contains: query } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * 북마크 생성
   */
  async create(data: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>): Promise<Bookmark> {
    return this.prisma.bookmark.create({
      data: {
        ...data,
        id: this.generateId(),
        folder: data.folder || 'default'
      }
    });
  }

  /**
   * 북마크 수정
   */
  async update(id: string, data: Partial<Omit<Bookmark, 'id' | 'createdAt'>>): Promise<Bookmark> {
    return this.prisma.bookmark.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  /**
   * 북마크 삭제
   */
  async delete(id: string): Promise<Bookmark> {
    return this.prisma.bookmark.delete({
      where: { id }
    });
  }

  /**
   * 폴더별 북마크 삭제
   */
  async deleteByFolder(folder: string): Promise<{ count: number }> {
    return this.prisma.bookmark.deleteMany({
      where: { folder }
    });
  }

  /**
   * 모든 북마크 삭제
   */
  async deleteAll(): Promise<{ count: number }> {
    return this.prisma.bookmark.deleteMany();
  }

  /**
   * 북마크 개수 조회
   */
  async count(): Promise<number> {
    return this.prisma.bookmark.count();
  }

  /**
   * 폴더 목록 조회 (distinct)
   */
  async getFolders(): Promise<string[]> {
    const bookmarks = await this.prisma.bookmark.findMany({
      distinct: ['folder'],
      select: { folder: true }
    });
    return bookmarks.map((b) => b.folder);
  }

  /**
   * UUID 생성 (간단한 ID 생성)
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default BookmarkRepository;
