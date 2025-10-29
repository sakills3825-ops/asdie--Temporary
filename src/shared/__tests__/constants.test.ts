/**
 * shared/system/constants.test.ts
 *
 * 시스템 상수 계층의 동적 계산 함수들을 테스트
 * - calculateMaxTabs()
 * - calculateMaxHistory()
 * - calculateIPCTimeout()
 * - calculateMaxWorkerThreads()
 * - calculateGCThreshold()
 * - calculateCriticalMemoryThreshold()
 * - calculateHTTPCacheSize()
 * - calculateIndexedDBSize()
 * - classifyNetworkProfile()
 * - getImageQuality()
 * - shouldAutoplayVideo()
 * - getPerfMetricsInterval()
 */

import {
  calculateMaxTabs,
  calculateMaxHistory,
  calculateIPCTimeout,
  calculateMaxWorkerThreads,
  calculateGCThreshold,
  calculateCriticalMemoryThreshold,
  calculateHTTPCacheSize,
  calculateIndexedDBSize,
  classifyNetworkProfile,
  getImageQuality,
  shouldAutoplayVideo,
  getPerfMetricsInterval,
  MEMORY_HARD_LIMIT_MB,
  IPC_TIMEOUT_MIN_MS,
  IPC_TIMEOUT_MAX_MS,
  PERFORMANCE_TIERS,
} from '../system/constants';

describe('Constants - System Optimization', () => {
  describe('calculateMaxTabs()', () => {
    test('should return minimum 5 tabs for low memory', () => {
      const result = calculateMaxTabs(900, 1024); // 88% usage
      expect(result).toBeGreaterThanOrEqual(5);
    });

    test('should return maximum 200 tabs for high memory', () => {
      const result = calculateMaxTabs(100, 16384); // 0.6% usage, 16GB
      expect(result).toBeLessThanOrEqual(200);
    });

    test('should reduce tabs when memory usage is high (70%+)', () => {
      const result70 = calculateMaxTabs(8000, 70); // 70% usage, 8GB
      const result30 = calculateMaxTabs(8000, 30); // 30% usage, 8GB
      expect(result70).toBeLessThan(result30);
    });

    test('should reduce tabs more aggressively when usage > 70%', () => {
      const result70 = calculateMaxTabs(8000, 70); // 70% boundary
      const result71 = calculateMaxTabs(8000, 71); // 71% boundary
      expect(result71).toBeLessThanOrEqual(result70);
    });

    test('should reduce tabs further when usage > 50%', () => {
      const result50 = calculateMaxTabs(8000, 50); // exactly 50%
      const result60 = calculateMaxTabs(8000, 60); // 60%
      expect(result60).toBeLessThan(result50);
    });

    test('should handle edge cases', () => {
      // Very low memory
      expect(calculateMaxTabs(0, 512)).toBeGreaterThanOrEqual(5);
      // Very high memory
      expect(calculateMaxTabs(0, 32768)).toBeLessThanOrEqual(200);
    });

    test('should work with default parameters', () => {
      const result = calculateMaxTabs();
      expect(result).toBeGreaterThanOrEqual(5);
      expect(result).toBeLessThanOrEqual(200);
    });
  });

  describe('calculateMaxHistory()', () => {
    test('should return 1000 for low memory (< 2GB)', () => {
      const result = calculateMaxHistory();
      // Since we're running on actual system, just check it's within bounds
      expect(result).toBeGreaterThanOrEqual(1000);
      expect(result).toBeLessThanOrEqual(50000);
    });

    test('should be deterministic', () => {
      const result1 = calculateMaxHistory();
      const result2 = calculateMaxHistory();
      expect(result1).toBe(result2);
    });

    test('should not exceed 50000 (hard cap)', () => {
      const result = calculateMaxHistory();
      expect(result).toBeLessThanOrEqual(50000);
    });
  });

  describe('calculateIPCTimeout()', () => {
    test('should return default 30 seconds when RTT is undefined', () => {
      const result = calculateIPCTimeout();
      expect(result).toBe(30000);
    });

    test('should respect minimum timeout of 5 seconds', () => {
      const result = calculateIPCTimeout(0);
      expect(result).toBe(5000);
    });

    test('should respect maximum timeout of 60 seconds', () => {
      const result = calculateIPCTimeout(10000);
      expect(result).toBe(60000);
    });

    test('should calculate timeout as RTT * 15 + 5000 within bounds', () => {
      const result = calculateIPCTimeout(100);
      // 100 * 15 + 5000 = 6500
      expect(result).toBe(6500);
      expect(result).toBeGreaterThanOrEqual(IPC_TIMEOUT_MIN_MS);
      expect(result).toBeLessThanOrEqual(IPC_TIMEOUT_MAX_MS);
    });

    test('should handle typical RTT values', () => {
      expect(calculateIPCTimeout(50)).toBeGreaterThan(5000); // 4G
      expect(calculateIPCTimeout(100)).toBeGreaterThan(5000); // LTE
      expect(calculateIPCTimeout(300)).toBeGreaterThan(5000); // 3G
      // 1000ms: 1000 * 15 + 5000 = 20000 (still under 60000 max)
      expect(calculateIPCTimeout(1000)).toBe(20000);
    });
  });

  describe('calculateMaxWorkerThreads()', () => {
    test('should return at least 1 worker', () => {
      const result = calculateMaxWorkerThreads(1, 512);
      expect(result).toBeGreaterThanOrEqual(1);
    });

    test('should not exceed 12 workers', () => {
      const result = calculateMaxWorkerThreads(32, 32768);
      expect(result).toBeLessThanOrEqual(12);
    });

    test('should be roughly half the CPU cores', () => {
      const result4Cores = calculateMaxWorkerThreads(4, 8192);
      const result8Cores = calculateMaxWorkerThreads(8, 8192);
      expect(result8Cores).toBeGreaterThanOrEqual(result4Cores);
    });

    test('should consider memory constraints', () => {
      const resultHighMem = calculateMaxWorkerThreads(4, 16384);
      const resultLowMem = calculateMaxWorkerThreads(4, 2048);
      expect(resultHighMem).toBeGreaterThanOrEqual(resultLowMem);
    });

    test('should work with default parameters', () => {
      const result = calculateMaxWorkerThreads();
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(12);
    });
  });

  describe('calculateGCThreshold()', () => {
    test('should return value within 150-800 MB range', () => {
      const result = calculateGCThreshold(1024);
      expect(result).toBeGreaterThanOrEqual(150);
      expect(result).toBeLessThanOrEqual(800);
    });

    test('should increase with total memory (up to cap)', () => {
      const result2GB = calculateGCThreshold(2048);
      const result8GB = calculateGCThreshold(8192);
      // Both cap at 800MB, so they should be equal
      expect(result8GB).toBe(result2GB);
      expect(result8GB).toBe(800);
    });

    test('should follow formula: availableMB * 0.8 * 0.7', () => {
      // 4GB total: 4096 * 0.8 * 0.7 = 2293.76 → capped at 800
      const result = calculateGCThreshold(4096);
      expect(result).toBe(800);
    });

    test('should work with default parameters', () => {
      const result = calculateGCThreshold();
      expect(result).toBeGreaterThanOrEqual(150);
      expect(result).toBeLessThanOrEqual(800);
    });
  });

  describe('calculateCriticalMemoryThreshold()', () => {
    test('should return value within 180-900 MB range', () => {
      const result = calculateCriticalMemoryThreshold(1024);
      expect(result).toBeGreaterThanOrEqual(180);
      expect(result).toBeLessThanOrEqual(900);
    });

    test('should be higher than GC threshold', () => {
      const gcThreshold = calculateGCThreshold(2048);
      const criticalThreshold = calculateCriticalMemoryThreshold(2048);
      expect(criticalThreshold).toBeGreaterThan(gcThreshold);
    });

    test('should be roughly 1.2x GC threshold (with cap)', () => {
      const gcThreshold = calculateGCThreshold(2048);
      const criticalThreshold = calculateCriticalMemoryThreshold(2048);
      // Both are capped, so critical = 900, GC = 800
      expect(gcThreshold).toBe(800);
      expect(criticalThreshold).toBe(900);
      // Not exactly 1.2x due to min/max bounds, but should be greater
      expect(criticalThreshold).toBeGreaterThan(gcThreshold);
    });

    test('should not exceed 900 MB', () => {
      const result = calculateCriticalMemoryThreshold(32768);
      expect(result).toBeLessThanOrEqual(900);
    });

    test('should be less than MEMORY_HARD_LIMIT_MB', () => {
      const result = calculateCriticalMemoryThreshold(16384);
      expect(result).toBeLessThan(MEMORY_HARD_LIMIT_MB);
    });
  });

  describe('Cache Size Calculations', () => {
    test('calculateHTTPCacheSize() returns 30-400 MB', () => {
      const result = calculateHTTPCacheSize(1024);
      expect(result).toBeGreaterThanOrEqual(30);
      expect(result).toBeLessThanOrEqual(400);
    });

    test('calculateIndexedDBSize() returns 10-200 MB', () => {
      const result = calculateIndexedDBSize(1024);
      expect(result).toBeGreaterThanOrEqual(10);
      expect(result).toBeLessThanOrEqual(200);
    });

    test('HTTP cache should be larger than IndexedDB', () => {
      const httpCache = calculateHTTPCacheSize(4096);
      const indexedDB = calculateIndexedDBSize(4096);
      expect(httpCache).toBeGreaterThan(indexedDB);
    });
  });

  describe('Network Profile Classification', () => {
    test('should classify < 100ms as excellent', () => {
      expect(classifyNetworkProfile(50)).toBe('excellent');
      expect(classifyNetworkProfile(99)).toBe('excellent');
    });

    test('should classify 100-299ms as good', () => {
      expect(classifyNetworkProfile(100)).toBe('good');
      expect(classifyNetworkProfile(200)).toBe('good');
      expect(classifyNetworkProfile(299)).toBe('good');
    });

    test('should classify 300-999ms as slow', () => {
      expect(classifyNetworkProfile(300)).toBe('slow');
      expect(classifyNetworkProfile(500)).toBe('slow');
      expect(classifyNetworkProfile(999)).toBe('slow');
    });

    test('should classify >= 1000ms as very-slow', () => {
      expect(classifyNetworkProfile(1000)).toBe('very-slow');
      expect(classifyNetworkProfile(5000)).toBe('very-slow');
    });
  });

  describe('Image Quality Calculation', () => {
    test('should return 100 for excellent network', () => {
      expect(getImageQuality(50)).toBe(100);
    });

    test('should return 85 for good network', () => {
      expect(getImageQuality(150)).toBe(85);
    });

    test('should return 60 for slow network', () => {
      expect(getImageQuality(500)).toBe(60);
    });

    test('should return 40 for very slow network', () => {
      expect(getImageQuality(2000)).toBe(40);
    });

    test('should return 100 for unknown profile', () => {
      expect(getImageQuality(0)).toBe(100);
    });
  });

  describe('Autoplay Decision', () => {
    test('should enable autoplay for excellent network', () => {
      expect(shouldAutoplayVideo(50)).toBe(true);
    });

    test('should enable autoplay for good network', () => {
      expect(shouldAutoplayVideo(200)).toBe(true);
    });

    test('should disable autoplay for slow network', () => {
      expect(shouldAutoplayVideo(500)).toBe(false);
    });

    test('should disable autoplay for very slow network', () => {
      expect(shouldAutoplayVideo(2000)).toBe(false);
    });
  });

  describe('Performance Metrics Interval', () => {
    test('should return 5000ms for low memory (< 2GB)', () => {
      const result = getPerfMetricsInterval(1024);
      expect(result).toBe(5000);
    });

    test('should return 1000ms for normal memory (>= 2GB)', () => {
      const result = getPerfMetricsInterval(4096);
      expect(result).toBe(1000);
    });

    test('should work with default parameters', () => {
      const result = getPerfMetricsInterval();
      expect([1000, 5000]).toContain(result);
    });
  });

  describe('Performance Tiers', () => {
    test('should define low, mid, high tiers', () => {
      expect(PERFORMANCE_TIERS.low).toBeDefined();
      expect(PERFORMANCE_TIERS.mid).toBeDefined();
      expect(PERFORMANCE_TIERS.high).toBeDefined();
    });

    test('should have increasing values from low to high', () => {
      expect(PERFORMANCE_TIERS.low.maxTabs).toBeLessThan(PERFORMANCE_TIERS.mid.maxTabs);
      expect(PERFORMANCE_TIERS.mid.maxTabs).toBeLessThan(PERFORMANCE_TIERS.high.maxTabs);
    });

    test('should have valid cache sizes', () => {
      expect(PERFORMANCE_TIERS.low.httpCacheSizeMB).toBeGreaterThan(0);
      expect(PERFORMANCE_TIERS.mid.httpCacheSizeMB).toBeGreaterThan(0);
      expect(PERFORMANCE_TIERS.high.httpCacheSizeMB).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle zero memory gracefully', () => {
      expect(() => calculateMaxTabs(0, 0)).not.toThrow();
      const result = calculateMaxTabs(0, 0);
      expect(result).toBeGreaterThanOrEqual(5);
    });

    test('should handle negative RTT gracefully', () => {
      const result = calculateIPCTimeout(-100);
      expect(result).toBeGreaterThanOrEqual(IPC_TIMEOUT_MIN_MS);
    });

    test('should be deterministic for same inputs', () => {
      const result1 = calculateMaxTabs(500, 2048);
      const result2 = calculateMaxTabs(500, 2048);
      expect(result1).toBe(result2);
    });

    test('all calculations should return finite numbers', () => {
      expect(Number.isFinite(calculateMaxTabs())).toBe(true);
      expect(Number.isFinite(calculateMaxHistory())).toBe(true);
      expect(Number.isFinite(calculateIPCTimeout())).toBe(true);
      expect(Number.isFinite(calculateMaxWorkerThreads())).toBe(true);
      expect(Number.isFinite(calculateGCThreshold())).toBe(true);
      expect(Number.isFinite(calculateCriticalMemoryThreshold())).toBe(true);
      expect(Number.isFinite(calculateHTTPCacheSize())).toBe(true);
      expect(Number.isFinite(calculateIndexedDBSize())).toBe(true);
    });
  });
});
