/**
 * IpcResponse 타입 안전성 테스트
 * 
 * discriminated union (상호 배타 필드) 동작 검증
 */

import { IpcResponseHelper, type IpcResponse } from '../types';

describe('IpcResponse 타입', () => {
  describe('IpcResponseHelper.success()', () => {
    it('성공 응답을 생성해야 함', () => {
      const response = IpcResponseHelper.success('result');

      expect(response.success).toBe(true);
      expect(response.data).toBe('result');
      expect(response).not.toHaveProperty('error');
    });

    it('코드와 함께 성공 응답을 생성해야 함', () => {
      const response = IpcResponseHelper.success({ count: 42 }, 'E_SUCCESS');

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ count: 42 });
      expect(response.code).toBe('E_SUCCESS');
    });

    it('void 타입을 지원해야 함', () => {
      const response = IpcResponseHelper.success(undefined);

      expect(response.success).toBe(true);
      expect(response.data).toBeUndefined();
    });
  });

  describe('IpcResponseHelper.error()', () => {
    it('에러 응답을 생성해야 함', () => {
      const response = IpcResponseHelper.error('Something failed', 'E_FAILURE');

      expect(response.success).toBe(false);
      expect(response.error).toBe('Something failed');
      expect(response.code).toBe('E_FAILURE');
      expect(response).not.toHaveProperty('data');
    });

    it('기본 에러 코드를 사용해야 함', () => {
      const response = IpcResponseHelper.error('Unknown error');

      expect(response.success).toBe(false);
      expect(response.error).toBe('Unknown error');
      expect(response.code).toBe('E_UNKNOWN');
    });
  });

  describe('타입 좁히기 (Type Narrowing)', () => {
    it('success === true일 때 data 접근 가능', () => {
      const response: IpcResponse<string> = IpcResponseHelper.success('result');

      if (response.success) {
        // TypeScript가 자동으로 data 타입을 알고 있음
        expect(response.data).toBe('result');
        // @ts-expect-error - error 필드는 존재하지 않음
        expect(response.error).toBeUndefined();
      }
    });

    it('success === false일 때 error 접근 가능', () => {
      const response: IpcResponse<string> = IpcResponseHelper.error('Failed', 'E_FAIL');

      if (!response.success) {
        // TypeScript가 자동으로 error 타입을 알고 있음
        expect(response.error).toBe('Failed');
        expect(response.code).toBe('E_FAIL');
        // @ts-expect-error - data 필드는 존재하지 않음
        expect(response.data).toBeUndefined();
      }
    });

    it('switch문으로 타입 좁히기', () => {
      const successResponse: IpcResponse<number> = IpcResponseHelper.success(42);
      const errorResponse: IpcResponse<number> = IpcResponseHelper.error('Failed', 'E_FAIL');

      const handleResponse = (response: IpcResponse<number>): string => {
        switch (response.success) {
          case true:
            return `Success: ${response.data}`;
          case false:
            return `Error: ${response.error} (${response.code})`;
        }
      };

      expect(handleResponse(successResponse)).toBe('Success: 42');
      expect(handleResponse(errorResponse)).toBe('Error: Failed (E_FAIL)');
    });
  });

  describe('실무 시나리오', () => {
    describe('IPC 핸들러', () => {
      async function readFileHandler(path: string): Promise<IpcResponse<string>> {
        try {
          // 파일 읽기 시뮬레이션
          if (path === '/valid/file.txt') {
            return IpcResponseHelper.success('file contents');
          }
          if (path === '/not/found.txt') {
            return IpcResponseHelper.error('File not found', 'E_FILE_NOT_FOUND');
          }
          throw new Error('Unexpected error');
        } catch (err) {
          return IpcResponseHelper.error(
            err instanceof Error ? err.message : 'Unknown error',
            'E_INTERNAL'
          );
        }
      }

      it('성공 케이스를 처리해야 함', async () => {
        const response = await readFileHandler('/valid/file.txt');

        expect(response.success).toBe(true);
        if (response.success) {
          expect(response.data).toBe('file contents');
        }
      });

      it('에러 케이스를 처리해야 함', async () => {
        const response = await readFileHandler('/not/found.txt');

        expect(response.success).toBe(false);
        if (!response.success) {
          expect(response.error).toBe('File not found');
          expect(response.code).toBe('E_FILE_NOT_FOUND');
        }
      });

      it('예외를 에러 응답으로 변환해야 함', async () => {
        const response = await readFileHandler('/unexpected/path');

        expect(response.success).toBe(false);
        if (!response.success) {
          expect(response.error).toBe('Unexpected error');
          expect(response.code).toBe('E_INTERNAL');
        }
      });
    });

    describe('Renderer에서 응답 처리', () => {
      async function invokeIpc(channel: string): Promise<IpcResponse<string>> {
        // IPC 호출 시뮬레이션
        if (channel === 'success') {
          return IpcResponseHelper.success('data');
        }
        return IpcResponseHelper.error('Failed', 'E_FAIL');
      }

      it('성공 응답을 추출해야 함', async () => {
        const response = await invokeIpc('success');

        if (response.success) {
          const data = response.data; // string 타입
          expect(data).toBe('data');
        } else {
          fail('Should be success');
        }
      });

      it('에러를 처리해야 함', async () => {
        const response = await invokeIpc('error');

        if (!response.success) {
          const error = response.error; // string 타입
          const code = response.code; // string 타입
          expect(error).toBe('Failed');
          expect(code).toBe('E_FAIL');
        } else {
          fail('Should be error');
        }
      });
    });

    describe('제네릭 타입', () => {
      interface User {
        id: string;
        name: string;
      }

      it('복잡한 타입을 지원해야 함', () => {
        const user: User = { id: '123', name: 'Alice' };
        const response = IpcResponseHelper.success<User>(user);

        expect(response.success).toBe(true);
        if (response.success) {
          expect(response.data.id).toBe('123');
          expect(response.data.name).toBe('Alice');
        }
      });

      it('배열 타입을 지원해야 함', () => {
        const users: User[] = [
          { id: '1', name: 'Alice' },
          { id: '2', name: 'Bob' },
        ];
        const response = IpcResponseHelper.success<User[]>(users);

        expect(response.success).toBe(true);
        if (response.success) {
          expect(response.data).toHaveLength(2);
          expect(response.data[0].name).toBe('Alice');
        }
      });
    });
  });

  describe('상호 배타성 (Mutual Exclusion)', () => {
    it('success와 error가 동시에 존재할 수 없음', () => {
      const successResponse = IpcResponseHelper.success('data');
      const errorResponse = IpcResponseHelper.error('error', 'E_CODE');

      // 성공 응답에는 error 필드가 없음
      expect(successResponse).not.toHaveProperty('error');

      // 에러 응답에는 data 필드가 없음
      expect(errorResponse).not.toHaveProperty('data');
    });

    it('타입 시스템이 상호 배타성을 보장해야 함', () => {
      const response: IpcResponse<string> = IpcResponseHelper.success('data');

      if (response.success) {
        // 컴파일 타임: data 존재, error 없음
        const data: string = response.data; // ✅ 정상
        expect(data).toBe('data');

        // @ts-expect-error - error는 존재하지 않음
        const error = response.error; // ❌ 타입 에러
        expect(error).toBeUndefined();
      }
    });
  });
});
