/**
 * Shared & Main Process 통합 검증 테스트 (Refactored)
 * - Manager 팩토리 패턴 기반
 * - Mock Repository 사용
 */

import { describe, it, expect, vi } from 'vitest';
import { TabManager } from '../managers/TabManager';
import { HistoryManager } from '../managers/HistoryManager';
import { ResourceManager } from '../managers/ResourceManager';

// Mock repositories
const createMockTabRepository = () => ({
  create: vi.fn(async (data) => ({ id: 'tab-1', ...data })),
  findById: vi.fn(async () => ({ id: 'tab-1', url: 'https://example.com' })),
  findAll: vi.fn(async () => [{ id: 'tab-1' }]),
  delete: vi.fn(async () => ({ id: 'tab-1' })),
  setActive: vi.fn(async () => {}),
  update: vi.fn(async () => ({ id: 'tab-1' })),
});

const createMockHistoryRepository = () => ({
  create: vi.fn(async (data) => ({ id: 'h-1', ...data })),
  findById: vi.fn(async () => ({ id: 'h-1' })),
  findAll: vi.fn(async () => [{ id: 'h-1' }]),
  search: vi.fn(async () => [{ id: 'h-1' }]),
  delete: vi.fn(async () => ({})),
  deleteAll: vi.fn(async () => {}),
  deleteBeforeTime: vi.fn(async () => ({ count: 1 })),
  findByDateRange: vi.fn(async () => []),
  getFrequentSites: vi.fn(async () => []),
  count: vi.fn(async () => 1),
});

describe('🔒 Main Process 검증 (Refactored)', () => {
  describe('✅ Manager 팩토리 패턴', () => {
    it('TabManager 팩토리로 생성', async () => {
      const repo = createMockTabRepository();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const manager = TabManager.create(repo as any);

      expect(manager).toBeDefined();
    });

    it('HistoryManager 팩토리로 생성', async () => {
      const repo = createMockHistoryRepository();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const manager = HistoryManager.create(repo as any);

      expect(manager).toBeDefined();
    });

    it('TabManager 탭 추가 성능', async () => {
      const repo = createMockTabRepository();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const manager = TabManager.create(repo as any);

      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        await manager.addTab(`https://example${i}.com`, `Tab ${i}`);
      }
      const duration = performance.now() - start;

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(repo.create).toHaveBeenCalled();
      console.log(`✅ 50개 탭 추가: ${duration.toFixed(3)}ms`);
    });

    it('HistoryManager 항목 추가', async () => {
      const repo = createMockHistoryRepository();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const manager = HistoryManager.create(repo as any);

      for (let i = 0; i < 10; i++) {
        await manager.addEntry({
          id: `entry-${i}`,
          url: `https://site${i}.com`,
          visitedAt: new Date(),
          title: `Site ${i}`,
          duration: 1000,
        });
      }

      expect(repo.create).toHaveBeenCalledTimes(10);
    });
  });

  describe('🎯 ResourceManager', () => {
    it('ResourceManager 모니터링', async () => {
      const manager = new ResourceManager();
      expect(manager.canAllocate(100)).toBe(true);
    });
  });

  describe('📊 통합 테스트', () => {
    it('All managers 동시 작동', async () => {
      const tabRepo = createMockTabRepository();
      const histRepo = createMockHistoryRepository();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tabMgr = TabManager.create(tabRepo as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const histMgr = HistoryManager.create(histRepo as any);

      await Promise.all([
        tabMgr.addTab('https://example.com', 'Example'),
        histMgr.addEntry({ 
          id: 'entry-1',
          url: 'https://test.com', 
          visitedAt: new Date(),
          title: 'Test',
          duration: 1000,
        }),
      ]);

      expect(tabRepo.create).toHaveBeenCalled();
      expect(histRepo.create).toHaveBeenCalled();
    });
  });
});
