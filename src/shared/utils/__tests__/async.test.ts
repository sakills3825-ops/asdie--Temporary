/**
 * async.ts 종합 테스트 스위트
 *
 * 테스트 대상:
 * - withTimeout: Promise 타임아웃 처리
 * - withRetry: exponential backoff 재시도
 * - delay: 지연 함수
 * - sequential: 순차 실행
 * - parallel: 병렬 실행
 * - race: 경합 실행
 * - CancelablePromise: 취소 가능한 Promise
 *
 * 총 45개 테스트
 */

import {
  withTimeout,
  withRetry,
  delay,
  sequential,
  parallel,
  race,
  CancelablePromise,
} from '../async';
import { TimeoutError } from '../../errors';
import { LIMITS } from '../../constants';

describe('async.ts - 비동기 유틸리티 테스트', () => {
  // ============================================
  // withTimeout 테스트 (12개)
  // ============================================
  describe('withTimeout()', () => {
    it('정상: Promise가 타임아웃 내에 완료', async () => {
      const result = await withTimeout(Promise.resolve(42), 1000);
      expect(result).toBe(42);
    });

    it('타임아웃: 초과 시 TimeoutError throw', async () => {
      const slowPromise = new Promise((resolve) =>
        setTimeout(() => resolve(42), 1000)
      );
      await expect(withTimeout(slowPromise, 100)).rejects.toThrow(TimeoutError);
    });

    it('기본값: LIMITS.IPC_TIMEOUT_MS 사용', async () => {
      const slowPromise = new Promise((resolve) =>
        setTimeout(() => resolve(42), LIMITS.IPC_TIMEOUT_MS + 1000)
      );
      await expect(withTimeout(slowPromise)).rejects.toThrow(TimeoutError);
    }, 60000);

    it('빠른 완료: 100ms 이내 완료', async () => {
      const start = Date.now();
      const result = await withTimeout(
        new Promise((resolve) => setTimeout(() => resolve(42), 50)),
        1000
      );
      const elapsed = Date.now() - start;
      expect(result).toBe(42);
      expect(elapsed).toBeLessThan(150);
    });

    it('긴 작업: 타임아웃 직전에 완료', async () => {
      const start = Date.now();
      const result = await withTimeout(
        new Promise((resolve) => setTimeout(() => resolve(42), 900)),
        1000
      );
      const elapsed = Date.now() - start;
      expect(result).toBe(42);
      expect(elapsed).toBeGreaterThan(850);
      expect(elapsed).toBeLessThan(1050);
    });

    it('거의 동시: 타임아웃과 거의 동시에 완료', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        withTimeout(Promise.resolve(i), 100)
      );
      const results = await Promise.all(promises);
      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('Promise 거부: reject 전파', async () => {
      const rejectedPromise = Promise.reject(new Error('Original error'));
      await expect(withTimeout(rejectedPromise, 1000)).rejects.toThrow(
        'Original error'
      );
    });

    it('중첩 withTimeout: 내부 타임아웃 우선', async () => {
      const nested = withTimeout(
        new Promise((_, reject) => setTimeout(() => reject(new TimeoutError('Inner')), 100)),
        1000
      );
      await expect(withTimeout(nested, 2000)).rejects.toThrow('Inner');
    });

    it('0ms 타임아웃: 즉시 실패', async () => {
      const slowPromise = new Promise((resolve) =>
        setTimeout(() => resolve(42), 100)
      );
      await expect(withTimeout(slowPromise, 0)).rejects.toThrow(TimeoutError);
    });

    it('음수 타임아웃: 즉시 실패', async () => {
      const slowPromise = new Promise((resolve) =>
        setTimeout(() => resolve(42), 100)
      );
      await expect(withTimeout(slowPromise, -100)).rejects.toThrow(TimeoutError);
    });

    it('매우 큰 타임아웃: 수행 완료', async () => {
      const result = await withTimeout(Promise.resolve(42), 60000);
      expect(result).toBe(42);
    });

    it('타이밍 검증: ±100ms 정확도', async () => {
      const start = Date.now();
      try {
        await withTimeout(new Promise(() => {}), 500);
      } catch {
        // 무시
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThan(400);
      expect(elapsed).toBeLessThan(600);
    });
  });

  // ============================================
  // withRetry 테스트 (12개)
  // ============================================
  describe('withRetry()', () => {
    it('정상: 첫 시도에서 성공', async () => {
      const fn = jest.fn().mockResolvedValueOnce(42);
      const result = await withRetry(fn);
      expect(result).toBe(42);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('한 번 실패 후 성공: 재시도 2회 성공', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('First attempt'))
        .mockResolvedValueOnce(42);
      const result = await withRetry(fn, 3, 50);
      expect(result).toBe(42);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('모두 실패: maxAttempts 초과 후 throw', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));
      await expect(withRetry(fn, 3, 50)).rejects.toThrow('Always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('Exponential backoff: 지연 시간 증가', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockRejectedValueOnce(new Error('Attempt 2'))
        .mockResolvedValueOnce(42);

      const start = Date.now();
      const result = await withRetry(fn, 3, 100);
      const elapsed = Date.now() - start;

      expect(result).toBe(42);
      expect(elapsed).toBeGreaterThan(200);
      expect(elapsed).toBeLessThan(500);
    });

    it('기본값: maxAttempts=3, initialDelayMs=100', async () => {
      const fn = jest.fn().mockResolvedValueOnce(42);
      const result = await withRetry(fn);
      expect(result).toBe(42);
    });

    it('커스텀 값: maxAttempts=5, initialDelayMs=50', async () => {
      const fn = jest.fn().mockResolvedValueOnce(42);
      const result = await withRetry(fn, 5, 50);
      expect(result).toBe(42);
    });

    it('maxAttempts=1: 재시도 없음', async () => {
      const fn = jest.fn().mockRejectedValueOnce(new Error('Failed'));
      await expect(withRetry(fn, 1, 100)).rejects.toThrow('Failed');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('Error vs string 처리: 둘 다 에러로 변환', async () => {
      const fnError = jest.fn().mockRejectedValueOnce(new Error('Error object'));
      const fnString = jest.fn().mockRejectedValueOnce('Error string');

      await expect(withRetry(fnError, 1, 50)).rejects.toThrow('Error object');
      await expect(withRetry(fnString, 1, 50)).rejects.toThrow('Error string');
    });

    it('누적 지연: 총 지연시간 = 100ms + 200ms + 400ms', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('1'))
        .mockRejectedValueOnce(new Error('2'))
        .mockRejectedValueOnce(new Error('3'))
        .mockResolvedValueOnce(42);

      const start = Date.now();
      const result = await withRetry(fn, 4, 100);
      const elapsed = Date.now() - start;

      expect(result).toBe(42);
      expect(elapsed).toBeGreaterThan(500);
      expect(elapsed).toBeLessThan(900);
    });

    it('재시도 카운트: 정확한 시도 횟수 기록', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('1'))
        .mockRejectedValueOnce(new Error('2'))
        .mockResolvedValueOnce(42);

      await withRetry(fn, 5, 50);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  // ============================================
  // delay 테스트 (4개)
  // ============================================
  describe('delay()', () => {
    it('정상: 지정된 시간 대기', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThan(90);
      expect(elapsed).toBeLessThan(150);
    });

    it('0ms: 즉시 반환', async () => {
      const start = Date.now();
      await delay(0);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it('타이밍: ±50ms 오차 범위', async () => {
      const start = Date.now();
      await delay(200);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThan(150);
      expect(elapsed).toBeLessThan(250);
    });

    it('연쇄 delay: 여러 번 호출 시 누적 지연', async () => {
      const start = Date.now();
      await delay(50);
      await delay(50);
      await delay(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThan(130);
      expect(elapsed).toBeLessThan(200);
    });
  });

  // ============================================
  // sequential 테스트 (6개)
  // ============================================
  describe('sequential()', () => {
    it('정상: 순차 실행, 결과 배열 반환', async () => {
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.resolve(2),
        () => Promise.resolve(3),
      ];
      const result = await sequential(tasks);
      expect(result).toEqual([1, 2, 3]);
    });

    it('빈 배열: []', async () => {
      const result = await sequential([]);
      expect(result).toEqual([]);
    });

    it('하나의 task: 결과 배열 [result]', async () => {
      const tasks = [() => Promise.resolve(42)];
      const result = await sequential(tasks);
      expect(result).toEqual([42]);
    });

    it('여러 task: 순서 보존', async () => {
      const start = Date.now();
      const tasks = [
        () => delay(50).then(() => 'a'),
        () => delay(50).then(() => 'b'),
        () => delay(50).then(() => 'c'),
      ];
      const result = await sequential(tasks);
      const elapsed = Date.now() - start;

      expect(result).toEqual(['a', 'b', 'c']);
      expect(elapsed).toBeGreaterThan(140);
    });

    it('한 task 실패: 즉시 throw', async () => {
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.reject(new Error('Failed')),
        () => Promise.resolve(3),
      ];
      await expect(sequential(tasks)).rejects.toThrow('Failed');
    });

    it('의존성: 상태 관리로 순서 검증', async () => {
      let callOrder = '';
      const tasks = [
        () => {
          callOrder += 'a';
          return Promise.resolve('a');
        },
        () => {
          callOrder += 'b';
          return Promise.resolve('b');
        },
        () => {
          callOrder += 'c';
          return Promise.resolve('c');
        },
      ];
      await sequential(tasks);
      expect(callOrder).toBe('abc');
    });
  });

  // ============================================
  // parallel 테스트 (6개)
  // ============================================
  describe('parallel()', () => {
    it('정상: Promise.all 동작', async () => {
      const promises = [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)];
      const result = await parallel(promises);
      expect(result).toEqual([1, 2, 3]);
    });

    it('빈 배열: []', async () => {
      const result = await parallel([]);
      expect(result).toEqual([]);
    });

    it('하나의 Promise: 결과 배열 [result]', async () => {
      const result = await parallel([Promise.resolve(42)]);
      expect(result).toEqual([42]);
    });

    it('여러 Promise: 순서 보존', async () => {
      const promises = [
        new Promise((resolve) => setTimeout(() => resolve('a'), 100)),
        new Promise((resolve) => setTimeout(() => resolve('b'), 50)),
        new Promise((resolve) => setTimeout(() => resolve('c'), 75)),
      ];

      const start = Date.now();
      const result = await parallel(promises);
      const elapsed = Date.now() - start;

      expect(result).toEqual(['a', 'b', 'c']);
      expect(elapsed).toBeGreaterThan(80);
      expect(elapsed).toBeLessThan(150);
    });

    it('하나 실패: 모두 실패', async () => {
      const promises = [
        Promise.resolve(1),
        Promise.reject(new Error('Failed')),
        Promise.resolve(3),
      ];
      await expect(parallel(promises)).rejects.toThrow('Failed');
    });

    it('타이밍: 병렬 실행 (최대값 기준)', async () => {
      const promises = [
        new Promise((resolve) => setTimeout(() => resolve(1), 200)),
        new Promise((resolve) => setTimeout(() => resolve(2), 100)),
        new Promise((resolve) => setTimeout(() => resolve(3), 150)),
      ];

      const start = Date.now();
      await parallel(promises);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThan(180);
      expect(elapsed).toBeLessThan(250);
    });
  });

  // ============================================
  // race 테스트 (4개)
  // ============================================
  describe('race()', () => {
    it('정상: Promise.race 동작', async () => {
      const promises = [
        new Promise((resolve) => setTimeout(() => resolve('slow'), 200)),
        new Promise((resolve) => setTimeout(() => resolve('fast'), 50)),
      ];
      const result = await race(promises);
      expect(result).toBe('fast');
    });

    it('첫 번째 승리: 첫 번째 Promise 반환', async () => {
      const promises = [
        new Promise((resolve) => setTimeout(() => resolve(1), 50)),
        new Promise((resolve) => setTimeout(() => resolve(2), 100)),
      ];
      const result = await race(promises);
      expect(result).toBe(1);
    });

    it('느린 Promise 무시: 두 번째는 무시됨', async () => {
      const promises = [
        new Promise((resolve) => setTimeout(() => resolve('first'), 50)),
        new Promise((resolve) =>
          setTimeout(() => {
            resolve('second');
          }, 100)
        ),
      ];
      const result = await race(promises);
      expect(result).toBe('first');
    });

    it('하나 실패: 가장 먼저 settle된 것 (reject)', async () => {
      const promises = [
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('First error')), 50)
        ),
        new Promise((resolve) => setTimeout(() => resolve('Success'), 100)),
      ];
      await expect(race(promises)).rejects.toThrow('First error');
    });
  });

  // ============================================
  // CancelablePromise 테스트 (5개)
  // ============================================
  describe('CancelablePromise', () => {
    it('execute() 정상: Promise 완료', async () => {
      const promise = Promise.resolve(42);
      const cancellable = new CancelablePromise(promise);
      const result = await cancellable.execute();
      expect(result).toBe(42);
    });

    it('cancel() 호출: execute() 결과 미반영', async () => {
      const promise = new Promise((resolve) => setTimeout(() => resolve(42), 100));
      const cancellable = new CancelablePromise(promise);

      cancellable.cancel();

      const executePromise = cancellable.execute();
      const result = await Promise.race([
        executePromise,
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 200)),
      ]);

      expect(result).toBe('timeout');
    });

    it('onCancel 콜백: cancel 시 호출', async () => {
      const onCancelFn = jest.fn();
      const promise = Promise.resolve(42);
      const cancellable = new CancelablePromise(promise, onCancelFn);

      cancellable.cancel();
      expect(onCancelFn).toHaveBeenCalled();
    });

    it('cancel 후 execute: aborted 상태 유지', async () => {
      const promise = Promise.resolve(42);
      const cancellable = new CancelablePromise(promise);

      cancellable.cancel();
      const result = await Promise.race([
        cancellable.execute(),
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 100)),
      ]);

      expect(result).toBe('timeout');
    });

    it('중복 cancel: 안전한 처리', async () => {
      const onCancelFn = jest.fn();
      const promise = Promise.resolve(42);
      const cancellable = new CancelablePromise(promise, onCancelFn);

      cancellable.cancel();
      cancellable.cancel();
      cancellable.cancel();

      expect(onCancelFn).toHaveBeenCalledTimes(3);
    });
  });
});
