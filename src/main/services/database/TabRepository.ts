/**
 * Tab Repository
 * 
 * Prisma를 사용한 BrowserTab 데이터 접근 계층
 * - 탭 CRUD 작업
 * - 활성 탭 관리
 * - 배치 작업
 */

import { PrismaClient, BrowserTab } from '@prisma/client';

/**
 * TabRepository 클래스
 * 데이터베이스 접근을 캡슐화
 */
export class TabRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 모든 탭 조회
   */
  async findAll(): Promise<BrowserTab[]> {
    return this.prisma.browserTab.findMany({
      orderBy: { updatedAt: 'desc' }
    });
  }

  /**
   * ID로 탭 조회
   */
  async findById(id: string): Promise<BrowserTab | null> {
    return this.prisma.browserTab.findUnique({
      where: { id }
    });
  }

  /**
   * 활성 탭 조회
   */
  async findActive(): Promise<BrowserTab[]> {
    return this.prisma.browserTab.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }
    });
  }

  /**
   * URL로 탭 조회 (중복 체크용)
   */
  async findByUrl(url: string): Promise<BrowserTab | null> {
    return this.prisma.browserTab.findFirst({
      where: { url }
    });
  }

  /**
   * 탭 생성
   */
  async create(data: {
    url: string;
    title: string;
    isActive?: boolean;
    favicon?: string | null;
  }): Promise<BrowserTab> {
    return this.prisma.browserTab.create({
      data: {
        url: data.url,
        title: data.title,
        isActive: data.isActive ?? false,
        favicon: data.favicon ?? null,
        id: this.generateId()
      }
    });
  }

  /**
   * 탭 수정
   */
  async update(id: string, data: Partial<Omit<BrowserTab, 'id' | 'createdAt'>>): Promise<BrowserTab> {
    return this.prisma.browserTab.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  /**
   * 탭 삭제
   */
  async delete(id: string): Promise<BrowserTab> {
    return this.prisma.browserTab.delete({
      where: { id }
    });
  }

  /**
   * 모든 탭 삭제
   */
  async deleteAll(): Promise<{ count: number }> {
    return this.prisma.browserTab.deleteMany();
  }

  /**
   * 활성 탭 변경
   * (하나의 탭만 활성 상태 유지)
   */
  async setActive(tabId: string): Promise<void> {
    // 다른 활성 탭 비활성화
    await this.prisma.browserTab.updateMany({
      where: { isActive: true, NOT: { id: tabId } },
      data: { isActive: false, updatedAt: new Date() }
    });

    // 선택 탭 활성화
    await this.prisma.browserTab.update({
      where: { id: tabId },
      data: { isActive: true, updatedAt: new Date() }
    });
  }

  /**
   * 배치 생성 (여러 탭 동시 생성)
   */
  async createMany(items: Array<Omit<BrowserTab, 'id' | 'createdAt' | 'updatedAt'>>): Promise<{ count: number }> {
    return this.prisma.browserTab.createMany({
      data: items.map(item => ({
        ...item,
        id: this.generateId()
      }))
    });
  }

  /**
   * 탭 개수 조회
   */
  async count(): Promise<number> {
    return this.prisma.browserTab.count();
  }

  /**
   * 임시 ID 생성
   * @returns ID 문자열
   */
  private generateId(): string {
    // TODO: cuid() 또는 uuid() 사용
    // 임시 구현
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default TabRepository;
