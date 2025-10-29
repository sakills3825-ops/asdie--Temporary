/**
 * History Repository
 * 
 * Prisma를 사용한 HistoryEntry 데이터 접근 계층
 * - 방문 기록 CRUD 작업
 * - 날짜 범위 검색
 * - 자주 방문한 사이트 조회
 */

import { PrismaClient, HistoryEntry } from '@prisma/client';

interface FrequentSite {
  url: string;
  count: number;
}

/**
 * HistoryRepository 클래스
 * 데이터베이스 접근을 캡슐화
 */
export class HistoryRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 모든 기록 조회
   */
  async findAll(limit?: number): Promise<HistoryEntry[]> {
    return this.prisma.historyEntry.findMany({
      take: limit || 100,
      orderBy: { visitedAt: 'desc' }
    });
  }

  /**
   * ID로 기록 조회
   */
  async findById(id: string): Promise<HistoryEntry | null> {
    return this.prisma.historyEntry.findUnique({
      where: { id }
    });
  }

  /**
   * URL로 기록 조회
   */
  async findByUrl(url: string): Promise<HistoryEntry[]> {
    return this.prisma.historyEntry.findMany({
      where: { url },
      orderBy: { visitedAt: 'desc' }
    });
  }

  /**
   * 키워드로 검색 (제목, URL)
   */
  async search(query: string, limit?: number): Promise<HistoryEntry[]> {
    return this.prisma.historyEntry.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { url: { contains: query } }
        ]
      },
      take: limit || 50,
      orderBy: { visitedAt: 'desc' }
    });
  }

  /**
   * 날짜 범위로 조회
   */
  async findByDateRange(startTime: Date, endTime: Date): Promise<HistoryEntry[]> {
    return this.prisma.historyEntry.findMany({
      where: {
        visitedAt: {
          gte: startTime,
          lte: endTime
        }
      },
      orderBy: { visitedAt: 'desc' }
    });
  }

  /**
   * 자주 방문한 사이트 조회
   */
  async getFrequentSites(limit?: number): Promise<FrequentSite[]> {
    const records = await this.prisma.historyEntry.groupBy({
      by: ['url'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: limit || 10
    });

    return records.map((r) => ({
      url: r.url,
      count: r._count.id
    }));
  }

  /**
   * 기록 생성
   */
  async create(data: Omit<HistoryEntry, 'id' | 'createdAt'>): Promise<HistoryEntry> {
    return this.prisma.historyEntry.create({
      data: {
        ...data,
        id: this.generateId(),
        visitedAt: data.visitedAt || new Date()
      }
    });
  }

  /**
   * 기록 수정
   */
  async update(id: string, data: Partial<Omit<HistoryEntry, 'id' | 'createdAt'>>): Promise<HistoryEntry> {
    return this.prisma.historyEntry.update({
      where: { id },
      data
    });
  }

  /**
   * 기록 삭제
   */
  async delete(id: string): Promise<HistoryEntry> {
    return this.prisma.historyEntry.delete({
      where: { id }
    });
  }

  /**
   * 모든 기록 삭제
   */
  async deleteAll(): Promise<{ count: number }> {
    return this.prisma.historyEntry.deleteMany();
  }

  /**
   * 특정 시간 이전 기록 삭제 (기간 정리)
   */
  async deleteBeforeTime(beforeTime: Date): Promise<{ count: number }> {
    return this.prisma.historyEntry.deleteMany({
      where: {
        visitedAt: {
          lt: beforeTime
        }
      }
    });
  }

  /**
   * 기록 개수 조회
   */
  async count(): Promise<number> {
    return this.prisma.historyEntry.count();
  }

  /**
   * UUID 생성 (간단한 ID 생성)
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default HistoryRepository;
