/**
 * 비동기 유틸리티 (Promise 관련)
 *
 * 타임아웃, 재시도, 병렬화 등 공통 패턴
 */

import { TimeoutError } from '../errors';
import { LIMITS } from '../constants';

/**
 * 타임아웃 래퍼
 * 주어진 시간 내에 Promise가 완료되지 않으면 TimeoutError throw
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = LIMITS.IPC_TIMEOUT_MS
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new TimeoutError(`Promise timed out after ${timeoutMs}ms`, {
              timeoutMs,
            })
          ),
        timeoutMs
      )
    ),
  ]);
}

/**
 * 재시도 래퍼 (exponential backoff)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelayMs: number = 100
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts - 1) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('Max retry attempts exceeded');
}

/**
 * 지연 생성 (타이머 기반)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 여러 Promise를 순차적으로 실행 (이전 결과 대기)
 */
export async function sequential<T>(tasks: (() => Promise<T>)[]): Promise<T[]> {
  const results: T[] = [];

  for (const task of tasks) {
    results.push(await task());
  }

  return results;
}

/**
 * 여러 Promise를 병렬로 실행 (모두 성공 필요)
 */
export function parallel<T>(promises: Promise<T>[]): Promise<T[]> {
  return Promise.all(promises);
}

/**
 * 여러 Promise 중 첫 번째 성공 반환
 */
export function race<T>(promises: Promise<T>[]): Promise<T> {
  return Promise.race(promises);
}

/**
 * 취소 가능한 Promise 생성
 */
export class CancelablePromise<T> {
  private isAborted = false;

  constructor(
    private promise: Promise<T>,
    private onCancel?: () => void
  ) {}

  async execute(): Promise<T> {
    return new Promise((resolve, reject) => {
      this.promise
        .then((result) => {
          if (!this.isAborted) {
            resolve(result);
          }
        })
        .catch((error) => {
          if (!this.isAborted) {
            reject(error);
          }
        });
    });
  }

  cancel(): void {
    this.isAborted = true;
    this.onCancel?.();
  }
}
