/**
 * Database Service
 * 
 * Prisma Client의 싱글톤 인스턴스를 관리하는 서비스.
 * - 개발: ./prisma/dev.db
 * - 배포: ~/.config/aside/aside.db
 * 
 * 문제점 해결:
 * 1. Hot reload 시 여러 PrismaClient 인스턴스 생성 방지 (global 사용)
 * 2. 환경별 DB 경로 자동 분리
 * 3. 쿼리 로깅 (개발 환경만)
 */

import path from 'path';
import os from 'os';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { TabRepository } from './TabRepository';
import { HistoryRepository } from './HistoryRepository';
import { BookmarkRepository } from './BookmarkRepository';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * DB 경로 결정
 * @returns SQLite 파일 경로 (file:// 프로토콜 포함)
 */
async function getDatabasePath(): Promise<string> {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // 개발: 프로젝트 루트 근처 (상대경로)
    return 'file:./prisma/dev.db';
  }

  // 배포: 플랫폼별 .config 디렉토리
  const configDir = path.join(os.homedir(), '.config', 'aside');
  
  // 디렉토리 생성 (없으면)
  try {
    await fs.promises.mkdir(configDir, { recursive: true });
  } catch (error) {
    // 디렉토리가 이미 존재하거나 다른 오류 발생 시 무시
    console.log(`Directory check/creation: ${configDir}`);
  }

  return `file:${path.join(configDir, 'aside.db')}`;
}

/**
 * Prisma Client 싱글톤 획득
 * 
 * 개발 환경에서 hot reload 시에도 같은 인스턴스 사용
 * @returns PrismaClient 인스턴스
 */
export async function getPrismaClient(): Promise<PrismaClient> {
  if (globalThis.prisma) {
    return globalThis.prisma;
  }

  const isDev = process.env.NODE_ENV === 'development';
  const databaseUrl = await getDatabasePath();

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    },
    // 개발 환경에서 로그 레벨 설정
    log: isDev ? ['query', 'info', 'warn'] : ['warn', 'error']
  });

  // 개발 환경에서만 global에 저장
  // (프로덕션에서는 매번 새로 생성되거나 모듈 캐싱 활용)
  if (isDev) {
    globalThis.prisma = prisma;
  }

  return prisma;
}

/**
 * Prisma Client 연결 종료
 */
export async function closePrismaClient(): Promise<void> {
  if (globalThis.prisma) {
    await globalThis.prisma.$disconnect();
    globalThis.prisma = undefined;
  }
}

/**
 * Database Service 싱글톤 클래스
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private prisma: PrismaClient;
  private tabRepository: TabRepository;
  private historyRepository: HistoryRepository;
  private bookmarkRepository: BookmarkRepository;

  private constructor(
    prisma: PrismaClient,
    tabRepository: TabRepository,
    historyRepository: HistoryRepository,
    bookmarkRepository: BookmarkRepository
  ) {
    this.prisma = prisma;
    this.tabRepository = tabRepository;
    this.historyRepository = historyRepository;
    this.bookmarkRepository = bookmarkRepository;
  }

  /**
   * DatabaseService 인스턴스 획득 (싱글톤)
   */
  static async getInstance(): Promise<DatabaseService> {
    if (!DatabaseService.instance) {
      const prisma = await getPrismaClient();
      const tabRepository = new TabRepository(prisma);
      const historyRepository = new HistoryRepository(prisma);
      const bookmarkRepository = new BookmarkRepository(prisma);
      
      DatabaseService.instance = new DatabaseService(
        prisma,
        tabRepository,
        historyRepository,
        bookmarkRepository
      );
    }
    return DatabaseService.instance;
  }

  /**
   * Prisma Client 획득
   */
  getClient(): PrismaClient {
    return this.prisma;
  }

  /**
   * TabRepository 획득
   */
  getTabRepository(): TabRepository {
    return this.tabRepository;
  }

  /**
   * HistoryRepository 획득
   */
  getHistoryRepository(): HistoryRepository {
    return this.historyRepository;
  }

  /**
   * BookmarkRepository 획득
   */
  getBookmarkRepository(): BookmarkRepository {
    return this.bookmarkRepository;
  }

  /**
   * DB 연결 종료
   */
  async disconnect(): Promise<void> {
    await closePrismaClient();
  }
}

export default DatabaseService;
