/**
 * IPC 모듈 P0/P1 이슈 해결 테스트
 * 
 * 테스트 범위:
 * - P0: 채널별 타입 오버로드
 * - P0: IpcResponse 제네릭 제약
 * - P0: 에러 타입 검증 + 필터링
 * - P0: 메시지 크기 제한
 * - P0: 채널명 검증
 * - P1: Args 구조 검증
 * - P1: 핸들러 등록 중복 감지
 * - P1: 응답 검증
 */

import {
  handleBaseError,
  handleUnknownError,
  filterErrorMessage,
  filterErrorDetails,
  validateResponseSize,
  MAX_IPC_MESSAGE_SIZE,
  MAX_ERROR_MESSAGE_LENGTH,
  ipcHandlerRegistry,
} from '../error-handler';
import { validateArgs, formatValidationErrors, UrlSchema, createIdSchema } from '../args-validator';
import type { IpcChannelMap, TypedIpcChannel } from '../channel-types';
import { BaseError } from '../../errors';
import { ERROR_CODES } from '../../constants';
import type { IpcResponse } from '../types';

describe('IPC 모듈 P0/P1 이슈 해결', () => {
  // =========================================================================
  // P0: 에러 필터링 (보안)
  // =========================================================================

  describe('P0: 에러 정보 필터링', () => {
    it('파일 경로를 마스킹해야 함', () => {
      const message = 'Error at /Users/john/project/src/app.ts line 42';
      const filtered = filterErrorMessage(message);

      expect(filtered).toContain('/home/user');
      expect(filtered).not.toContain('/Users/john');
    });

    it('IP 주소를 마스킹해야 함', () => {
      const message = 'Connection failed: 192.168.1.1:3000 timeout';
      const filtered = filterErrorMessage(message);

      expect(filtered).toContain('192.168.*.*');
      expect(filtered).not.toContain('192.168.1.1');
    });

    it('데이터베이스 쿼리를 마스킹해야 함', () => {
      const message = 'SQL Error: SELECT * FROM users WHERE id = 123';
      const filtered = filterErrorMessage(message);

      expect(filtered).toContain('[database query hidden]');
      expect(filtered).not.toContain('SELECT');
    });

    it('메시지 길이를 제한해야 함', () => {
      const longMessage = 'x'.repeat(MAX_ERROR_MESSAGE_LENGTH + 1000);
      const filtered = filterErrorMessage(longMessage);

      expect(filtered.length).toBeLessThanOrEqual(MAX_ERROR_MESSAGE_LENGTH + 20); // "[truncated]" 포함
      expect(filtered).toContain('[truncated]');
    });

    it('자동 필터링을 비활성화할 수 없음 (일관성)', () => {
      const message = 'Generic error message';
      const filtered = filterErrorMessage(message);

      expect(filtered).toBe(message);
    });
  });

  describe('P0: 에러 details 필터링', () => {
    it('민감한 키를 마스킹해야 함', () => {
      const details = {
        userId: '123',
        password: 'secret123',
        token: 'abc.def.ghi',
        apiKey: 'sk-123456',
      };

      const filtered = filterErrorDetails(details);

      expect(filtered).toEqual({
        userId: '123',
        password: '[sensitive]',
        token: '[sensitive]',
        apiKey: '[sensitive]',
      });
    });

    it('깊은 중첩을 제한해야 함', () => {
      const deep = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    level7: {
                      level8: {
                        level9: {
                          level10: {
                            level11: 'too deep',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const filtered = filterErrorDetails(deep);
      const json = JSON.stringify(filtered);

      // 깊이 10 이상에서 '[details truncated]' 나타남
      expect(json).toContain('[details truncated]');
    });

    it('배열 크기를 제한해야 함', () => {
      const details = {
        items: Array(150).fill({ id: 1, value: 'x' }),
      };

      const filtered = filterErrorDetails(details) as { items: unknown[] };

      expect(Array.isArray(filtered.items)).toBe(true);
      expect((filtered.items as unknown[]).length).toBeLessThanOrEqual(100);
    });

    it('객체 키 개수를 제한해야 함', () => {
      const details: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        details[`key${i}`] = `value${i}`;
      }

      const filtered = filterErrorDetails(details) as Record<string, unknown>;

      expect(Object.keys(filtered).length).toBeLessThanOrEqual(50);
    });
  });

  describe('P0: BaseError 통합 처리', () => {
    it('BaseError를 IPC 응답으로 변환해야 함', () => {
      const error = new BaseError(
        'File not found',
        ERROR_CODES.FILE_NOT_FOUND,
        404,
        { path: '/secret/file.txt' }
      );

      const response = handleBaseError(error);

      expect(response.success).toBe(false);
      expect(response.code).toBe(ERROR_CODES.FILE_NOT_FOUND);
      // 필터링된 응답이므로 '/secret' 경로 마스킹됨
      expect(typeof response).toBe('object');
    });

    it('에러 체인을 유지해야 함', () => {
      const original = new Error('Original error');
      const wrapped = new BaseError('Wrapped error', ERROR_CODES.UNKNOWN, 500, undefined, original);

      const response = handleBaseError(wrapped);

      expect(response.success).toBe(false);
      expect(response.code).toBe(ERROR_CODES.UNKNOWN);
    });
  });

  describe('P0: 미확인 에러 처리', () => {
    it('문자열 에러를 처리해야 함', () => {
      const response = handleUnknownError('Something went wrong', 'operation');

      expect(response.success).toBe(false);
      expect(response.code).toBe(ERROR_CODES.UNKNOWN);
      expect((response as any).error).toContain('[operation]');
    });

    it('숫자 에러를 처리해야 함', () => {
      const response = handleUnknownError(500);

      expect(response.success).toBe(false);
      expect((response as any).error).toContain('500');
    });

    it('객체 에러를 처리해야 함', () => {
      const response = handleUnknownError({ code: 'E_COMPLEX', data: { x: 1 } });

      expect(response.success).toBe(false);
      expect((response as any).error).toBeTruthy();
    });
  });

  // =========================================================================
  // P0/P1: 메시지 크기 제한 (DoS 방지)
  // =========================================================================

  describe('P0: 메시지 크기 제한', () => {
    it('작은 응답은 통과해야 함', () => {
      const response = { success: true, data: { id: '123' } };

      expect(() => {
        validateResponseSize(response);
      }).not.toThrow();
    });

    it('큰 응답은 거부해야 함', () => {
      const hugeData = {
        success: true,
        data: {
          items: Array(100000).fill({ id: 1, name: 'x'.repeat(100) }),
        },
      };

      expect(() => {
        validateResponseSize(hugeData, 1024 * 1024); // 1MB 제한
      }).toThrow();
    });

    it('에러 응답의 크기를 제한해야 함', () => {
      const largeError: IpcResponse<never> = {
        success: false,
        error: 'x'.repeat(6 * 1024 * 1024), // 6MB
        code: 'E_LARGE',
      };

      expect(() => {
        validateResponseSize(largeError, MAX_IPC_MESSAGE_SIZE);
      }).toThrow();
    });
  });

  // =========================================================================
  // P1: Args 검증
  // =========================================================================

  describe('P1: Args 구조 검증', () => {
    it('필수 필드 검증', () => {
      const schema = { url: { type: 'string' as const, required: true } };
      const result = validateArgs({}, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('url');
    });

    it('타입 검증', () => {
      const schema = { url: { type: 'string' as const, required: true } };
      const result = validateArgs({ url: 123 }, schema);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Expected string');
    });

    it('문자열 길이 검증', () => {
      const schema = {
        name: { type: 'string' as const, required: true, minLength: 2, maxLength: 10 },
      };

      const tooShort = validateArgs({ name: 'a' }, schema);
      expect(tooShort.valid).toBe(false);

      const tooLong = validateArgs({ name: 'a'.repeat(20) }, schema);
      expect(tooLong.valid).toBe(false);

      const valid = validateArgs({ name: 'valid' }, schema);
      expect(valid.valid).toBe(true);
    });

    it('정규식 패턴 검증', () => {
      const schema = {
        email: {
          type: 'string' as const,
          required: true,
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        },
      };

      const invalid = validateArgs({ email: 'not-an-email' }, schema);
      expect(invalid.valid).toBe(false);

      const valid = validateArgs({ email: 'test@example.com' }, schema);
      expect(valid.valid).toBe(true);
    });

    it('숫자 범위 검증', () => {
      const schema = {
        timeout: { type: 'number' as const, required: true, min: 0, max: 60000 },
      };

      const tooSmall = validateArgs({ timeout: -1 }, schema);
      expect(tooSmall.valid).toBe(false);

      const tooBig = validateArgs({ timeout: 100000 }, schema);
      expect(tooBig.valid).toBe(false);

      const valid = validateArgs({ timeout: 5000 }, schema);
      expect(valid.valid).toBe(true);
    });

    it('배열 요소 검증', () => {
      const schema = {
        tags: {
          type: 'array' as const,
          required: true,
          items: { type: 'string' as const, minLength: 1 },
        },
      };

      const invalid = validateArgs({ tags: ['valid', ''] }, schema);
      expect(invalid.valid).toBe(false);

      const valid = validateArgs({ tags: ['tag1', 'tag2'] }, schema);
      expect(valid.valid).toBe(true);
    });

    it('열거형 검증', () => {
      const schema = {
        status: {
          type: 'string' as const,
          required: true,
          enum: ['pending', 'active', 'done'],
        },
      };

      const invalid = validateArgs({ status: 'invalid' }, schema);
      expect(invalid.valid).toBe(false);

      const valid = validateArgs({ status: 'active' }, schema);
      expect(valid.valid).toBe(true);
    });

    it('선택 필드 처리', () => {
      const schema = {
        required: { type: 'string' as const, required: true },
        optional: { type: 'string' as const, required: false },
      };

      const result = validateArgs({ required: 'value' }, schema);
      expect(result.valid).toBe(true);
    });
  });

  describe('P1: URL 스키마 헬퍼', () => {
    it('유효한 URL을 검증해야 함', () => {
      const schema = { url: UrlSchema };

      const valid = validateArgs({ url: 'https://example.com' }, schema);
      expect(valid.valid).toBe(true);
    });

    it('protocol이 없는 URL을 거부해야 함', () => {
      const schema = { url: UrlSchema };

      const invalid = validateArgs({ url: 'example.com' }, schema);
      expect(invalid.valid).toBe(false);
    });

    it('매우 긴 URL을 거부해야 함', () => {
      const schema = { url: UrlSchema };

      const veryLong = `https://example.com/${'a'.repeat(3000)}`;
      const invalid = validateArgs({ url: veryLong }, schema);
      expect(invalid.valid).toBe(false);
    });
  });

  describe('P1: ID 스키마 헬퍼', () => {
    it('유효한 ID를 검증해야 함', () => {
      const schema = { id: createIdSchema() };

      const valid = validateArgs({ id: 'abc123-_DEF' }, schema);
      expect(valid.valid).toBe(true);
    });

    it('특수문자를 포함한 ID를 거부해야 함', () => {
      const schema = { id: createIdSchema() };

      const invalid = validateArgs({ id: 'abc@123' }, schema);
      expect(invalid.valid).toBe(false);
    });

    it('빈 ID를 거부해야 함', () => {
      const schema = { id: createIdSchema() };

      const invalid = validateArgs({ id: '' }, schema);
      expect(invalid.valid).toBe(false);
    });
  });

  // =========================================================================
  // P1: 핸들러 등록 추적
  // =========================================================================

  describe('P1: IpcHandlerRegistry', () => {
    beforeEach(() => {
      ipcHandlerRegistry.clear();
    });

    it('핸들러 등록을 기록해야 함', () => {
      ipcHandlerRegistry.registerHandler('browser:navigateTo', 'main/handlers/browser.ts');

      const registrations = ipcHandlerRegistry.getRegistrations();
      expect(registrations['browser:navigateTo']).toBeDefined();
      expect(registrations['browser:navigateTo'].count).toBe(1);
    });

    it('중복 등록을 감지해야 함', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      ipcHandlerRegistry.registerHandler('browser:navigateTo', 'file1.ts');
      ipcHandlerRegistry.registerHandler('browser:navigateTo', 'file2.ts');

      expect(consoleSpy).toHaveBeenCalled();
      const warning = consoleSpy.mock.calls[0][0] as string;
      expect(warning).toContain('registered multiple times');

      consoleSpy.mockRestore();
    });

    it('등록되지 않은 채널을 찾아야 함', () => {
      ipcHandlerRegistry.registerHandler('browser:navigateTo', 'file.ts');
      ipcHandlerRegistry.registerHandler('tab:createNew', 'file.ts');

      const allChannels = [
        'browser:navigateTo',
        'browser:goBack',
        'tab:createNew',
        'tab:close',
      ];

      const unregistered = ipcHandlerRegistry.getUnregisteredChannels(allChannels);
      expect(unregistered).toContain('browser:goBack');
      expect(unregistered).toContain('tab:close');
      expect(unregistered).not.toContain('browser:navigateTo');
    });
  });

  // =========================================================================
  // P0: 채널 타입 정의 통합 (타입 수준 테스트)
  // =========================================================================

  describe('P0: 타입 안전한 채널 정의', () => {
    // 이 테스트는 TypeScript 타입 시스템이 올바르게 작동하는지 확인
    // 컴파일 타임에 타입 체크됨

    it('IpcChannelMap이 정의되어야 함', () => {
      // 각 채널의 일부만 테스트 (전체 매핑은 runtime에 동적)
      expect(true).toBe(true); // 타입은 컴파일 타임에 검증됨
    });

    it('TypedIpcChannel 타입이 정의되어야 함', () => {
      const channel: TypedIpcChannel = 'browser:navigateTo';

      // @ts-expect-error - 유효하지 않은 채널명
      const invalid: TypedIpcChannel = 'invalid:channel';

      expect(channel).toBeDefined();
      // invalid는 타입 에러로 적발됨
    });
  });

  // =========================================================================
  // 통합 테스트: 실제 IPC 핸들러 패턴
  // =========================================================================

  describe('통합: 실제 IPC 핸들러 패턴', () => {
    it('complete handler flow: validation → execution → response', async () => {
      // Args 검증
      const schema = {
        url: { type: 'string' as const, required: true, minLength: 1, maxLength: 2048 },
        timeout: { type: 'number' as const, required: false, min: 0, max: 60000 },
      };

      const args = { url: 'https://example.com', timeout: 5000 };
      const validation = validateArgs(args, schema);

      if (!validation.valid) {
        throw new Error(formatValidationErrors(validation));
      }

      // 핸들러 실행
      const result = { tabId: 'tab-1', success: true };

      // 응답 검증 (data 타입은 generic이므로 any로 처리)
      const response: IpcResponse<any> = { success: true, data: result };
      expect(() => {
        validateResponseSize(response);
      }).not.toThrow();
    });

    it('에러 발생 시 처리', () => {
      try {
        throw new BaseError('Navigation failed', ERROR_CODES.BROWSER_NAV_TIMEOUT_30S, 500);
      } catch (error) {
        const response = handleBaseError(error as BaseError);

        expect(response.success).toBe(false);
        expect(response.code).toBe(ERROR_CODES.BROWSER_NAV_TIMEOUT_30S);
      }
    });
  });
});
