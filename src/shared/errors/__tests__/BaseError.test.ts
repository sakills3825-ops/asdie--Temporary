/**
 * BaseError 직렬화 및 에러 체인 테스트
 */

import { BaseError } from '../BaseError';
import {
  ValidationError,
  NetworkError,
  DatabaseError,
  FileError,
  TimeoutError,
  NotFoundError,
  IpcChannelError,
  WindowError,
} from '../AppError';
import { ERROR_CODES } from '../../constants';

describe('BaseError', () => {
  describe('기본 생성', () => {
    it('기본 필드가 올바르게 설정되어야 함', () => {
      const error = new BaseError('Test error');

      expect(error.name).toBe('BaseError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ERROR_CODES.UNKNOWN);
      expect(error.statusCode).toBe(500);
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.context).toBeUndefined();
      expect(error.cause).toBeUndefined();
      expect(error.stack).toBeDefined();
    });

    it('커스텀 코드와 상태코드가 설정되어야 함', () => {
      const error = new BaseError(
        'Custom error',
        ERROR_CODES.VALIDATION_INVALID_FORMAT,
        400
      );

      expect(error.code).toBe(ERROR_CODES.VALIDATION_INVALID_FORMAT);
      expect(error.statusCode).toBe(400);
    });

    it('컨텍스트가 저장되어야 함', () => {
      const context = { userId: '123', action: 'login' };
      const error = new BaseError('Error with context', ERROR_CODES.UNKNOWN, 500, context);

      expect(error.context).toEqual(context);
    });

    it('cause가 저장되어야 함', () => {
      const originalError = new Error('Original error');
      const error = new BaseError(
        'Wrapped error',
        ERROR_CODES.UNKNOWN,
        500,
        undefined,
        originalError
      );

      expect(error.cause).toBe(originalError);
    });
  });

  describe('toJSON()', () => {
    it('모든 필드를 직렬화해야 함', () => {
      const context = { userId: '123' };
      const error = new BaseError('Test error', ERROR_CODES.VALIDATION_INVALID_FORMAT, 400, context);

      const json = error.toJSON();

      expect(json.name).toBe('BaseError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe(ERROR_CODES.VALIDATION_INVALID_FORMAT);
      expect(json.statusCode).toBe(400);
      expect(json.context).toEqual(context);
      expect(json.stack).toBeDefined();
      expect(typeof json.timestamp).toBe('string'); // ISO string
    });

    it('cause가 포함되어야 함', () => {
      const originalError = new Error('Original');
      originalError.stack = 'Original stack trace';

      const error = new BaseError(
        'Wrapped',
        ERROR_CODES.UNKNOWN,
        500,
        undefined,
        originalError
      );

      const json = error.toJSON();

      expect(json.cause).toBeDefined();
      expect(json.cause?.name).toBe('Error');
      expect(json.cause?.message).toBe('Original');
      expect(json.cause?.stack).toBe('Original stack trace');
    });

    it('cause가 없으면 undefined여야 함', () => {
      const error = new BaseError('No cause');
      const json = error.toJSON();

      expect(json.cause).toBeUndefined();
    });

    it('JSON.stringify()가 작동해야 함', () => {
      const error = new BaseError('Test', ERROR_CODES.UNKNOWN, 500, { key: 'value' });
      const jsonString = JSON.stringify(error);
      const parsed = JSON.parse(jsonString);

      expect(parsed.name).toBe('BaseError');
      expect(parsed.message).toBe('Test');
      expect(parsed.code).toBe(ERROR_CODES.UNKNOWN);
      expect(parsed.context).toEqual({ key: 'value' });
      expect(parsed.stack).toBeDefined();
    });
  });

  describe('toClientResponse()', () => {
    it('민감한 정보를 제거해야 함', () => {
      const context = { password: 'secret123' };
      const error = new BaseError('Error with secrets', ERROR_CODES.UNKNOWN, 500, context);

      const clientResponse = error.toClientResponse();

      expect(clientResponse.error).toBe('Error with secrets');
      expect(clientResponse.code).toBe(ERROR_CODES.UNKNOWN);
      expect(clientResponse.statusCode).toBe(500);
      // 민감한 정보 제외
      expect(clientResponse).not.toHaveProperty('context');
      expect(clientResponse).not.toHaveProperty('stack');
      expect(clientResponse).not.toHaveProperty('cause');
    });
  });

  describe('toInternalLog()', () => {
    it('모든 정보를 포함해야 함', () => {
      const context = { userId: '123' };
      const originalError = new Error('Original');
      const error = new BaseError(
        'Test',
        ERROR_CODES.UNKNOWN,
        500,
        context,
        originalError
      );

      const log = error.toInternalLog();

      expect(log.name).toBe('BaseError');
      expect(log.message).toBe('Test');
      expect(log.code).toBe(ERROR_CODES.UNKNOWN);
      expect(log.statusCode).toBe(500);
      expect(log.context).toEqual(context);
      expect(log.stack).toBeDefined();
      expect(log.cause).toBeDefined();
      expect(log.cause?.message).toBe('Original');
    });
  });

  describe('instanceof', () => {
    it('instanceof가 작동해야 함', () => {
      const error = new BaseError('Test');

      expect(error instanceof BaseError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('프로토타입 체인', () => {
    it('name이 올바르게 설정되어야 함', () => {
      const error = new BaseError('Test');
      expect(error.name).toBe('BaseError');
    });

    it('constructor.name이 일치해야 함', () => {
      const error = new BaseError('Test');
      expect(error.constructor.name).toBe('BaseError');
    });
  });
});

describe('AppError 파생 클래스', () => {
  describe('ValidationError', () => {
    it('올바른 코드와 상태코드를 가져야 함', () => {
      const error = new ValidationError('Invalid input');

      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe(ERROR_CODES.VALIDATION_INVALID_FORMAT);
      expect(error.statusCode).toBe(400);
      expect(error instanceof ValidationError).toBe(true);
      expect(error instanceof BaseError).toBe(true);
    });

    it('cause를 지원해야 함', () => {
      const originalError = new Error('Parse error');
      const error = new ValidationError('Invalid JSON', undefined, originalError);

      expect(error.cause).toBe(originalError);
      const json = error.toJSON();
      expect(json.cause?.message).toBe('Parse error');
    });
  });

  describe('NetworkError', () => {
    it('올바른 코드와 상태코드를 가져야 함', () => {
      const error = new NetworkError('Connection failed');

      expect(error.name).toBe('NetworkError');
      expect(error.code).toBe(ERROR_CODES.NETWORK_CONNECTION_FAILED);
      expect(error.statusCode).toBe(503);
    });

    it('context와 cause를 지원해야 함', () => {
      const context = { url: 'https://api.example.com' };
      const originalError = new Error('ECONNREFUSED');
      const error = new NetworkError('Connection failed', context, originalError);

      expect(error.context).toEqual(context);
      expect(error.cause).toBe(originalError);
    });
  });

  describe('DatabaseError', () => {
    it('올바른 코드와 상태코드를 가져야 함', () => {
      const error = new DatabaseError('Query failed');

      expect(error.name).toBe('DatabaseError');
      expect(error.code).toBe(ERROR_CODES.DB_QUERY_ERROR);
      expect(error.statusCode).toBe(500);
    });

    it('cause가 전파되어야 함', () => {
      const sqlError = new Error('Duplicate key violation');
      const error = new DatabaseError('Insert failed', { table: 'users' }, sqlError);

      const json = error.toJSON();
      expect(json.cause?.message).toBe('Duplicate key violation');
    });
  });

  describe('FileError', () => {
    it('올바른 코드를 가져야 함', () => {
      const error = new FileError('File not found');

      expect(error.name).toBe('FileError');
      expect(error.code).toBe(ERROR_CODES.FILE_READ_ERROR);
      expect(error.statusCode).toBe(500);
    });

    it('커스텀 코드를 지원해야 함', () => {
      const error = new FileError('Permission denied', ERROR_CODES.FILE_ACCESS_DENIED);

      expect(error.code).toBe(ERROR_CODES.FILE_ACCESS_DENIED);
    });
  });

  describe('TimeoutError', () => {
    it('올바른 코드와 상태코드를 가져야 함', () => {
      const error = new TimeoutError('Request timeout');

      expect(error.name).toBe('TimeoutError');
      expect(error.code).toBe(ERROR_CODES.IPC_TIMEOUT_30S);
      expect(error.statusCode).toBe(504);
    });
  });

  describe('NotFoundError', () => {
    it('올바른 코드와 상태코드를 가져야 함', () => {
      const error = new NotFoundError('Resource not found');

      expect(error.name).toBe('NotFoundError');
      expect(error.code).toBe(ERROR_CODES.DB_NOT_FOUND);
      expect(error.statusCode).toBe(404);
    });
  });

  describe('IpcChannelError', () => {
    it('올바른 코드와 상태코드를 가져야 함', () => {
      const error = new IpcChannelError('Invalid channel');

      expect(error.name).toBe('IpcChannelError');
      expect(error.code).toBe(ERROR_CODES.IPC_CHANNEL_INVALID);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('WindowError', () => {
    it('올바른 코드와 상태코드를 가져야 함', () => {
      const error = new WindowError('Window not found');

      expect(error.name).toBe('WindowError');
      expect(error.code).toBe(ERROR_CODES.WINDOW_NOT_FOUND);
      expect(error.statusCode).toBe(400);
    });
  });
});

describe('에러 체인 시나리오', () => {
  it('다층 에러 체인이 작동해야 함', () => {
    // 최하위 에러
    const sqlError = new Error('Duplicate key');
    sqlError.stack = 'SQL stack trace';

    // 중간 에러
    const dbError = new DatabaseError('Insert failed', { table: 'users' }, sqlError);

    // 최상위 에러
    const appError = new BaseError(
      'User registration failed',
      ERROR_CODES.UNKNOWN,
      500,
      { userId: '123' },
      dbError
    );

    // JSON 직렬화
    const json = appError.toJSON();

    expect(json.message).toBe('User registration failed');
    expect(json.cause?.message).toBe('Insert failed');
    expect(json.cause?.stack).toContain('DatabaseError');
  });

  it('IPC 전송 시뮬레이션', () => {
    const originalError = new Error('ENOENT: no such file');
    const fileError = new FileError('Config file not found', undefined, { path: '/etc/config.json' }, originalError);

    // JSON 직렬화 (IPC 전송 시뮬레이션)
    const serialized = JSON.stringify(fileError);
    const deserialized = JSON.parse(serialized);

    // 역직렬화 후 데이터 확인
    expect(deserialized.name).toBe('FileError');
    expect(deserialized.message).toBe('Config file not found');
    expect(deserialized.context.path).toBe('/etc/config.json');
    expect(deserialized.cause.message).toBe('ENOENT: no such file');
    expect(deserialized.stack).toBeDefined();
  });

  it('클라이언트 응답에서 민감 정보 제거', () => {
    const dbError = new Error('Connection string: postgres://admin:secret@localhost');
    const error = new DatabaseError(
      'Database connection failed',
      { connectionString: 'postgres://admin:secret@localhost' },
      dbError
    );

    const clientResponse = error.toClientResponse();

    // 민감 정보 확인
    expect(JSON.stringify(clientResponse)).not.toContain('secret');
    expect(JSON.stringify(clientResponse)).not.toContain('connectionString');
    expect(JSON.stringify(clientResponse)).not.toContain('postgres://');
  });
});
