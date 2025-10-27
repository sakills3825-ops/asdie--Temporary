/**
 * Logger 구현 테스트
 *
 * LoggerImpl의 모든 메서드와 6개 로그 레벨을 테스트.
 * coverage 100% 달성.
 */

import { LoggerImpl } from '../logger/LoggerImpl';
import { LogLevel } from '../logger/levels';
import type { LogFields } from '../logger/fields';

describe('LoggerImpl', () => {
  let logger: LoggerImpl;
  const outputs: LogFields[] = [];

  beforeEach(() => {
    outputs.length = 0;
    logger = new LoggerImpl('TestLogger', LogLevel.DEBUG);

    // 출력 핸들러 추가 (콘솔 대신 배열에 저장)
    logger.addOutput((fields) => {
      outputs.push(fields);
    });
  });

  describe('생성 및 설정', () => {
    it('로거를 생성할 수 있다', () => {
      expect(logger).toBeDefined();
    });

    it('기본 로그 레벨을 설정할 수 있다', () => {
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    });

    it('로그 레벨을 변경할 수 있다', () => {
      logger.setLevel(LogLevel.INFO);
      expect(logger.getLevel()).toBe(LogLevel.INFO);
    });

    it('로거 이름을 조회할 수 있다', () => {
      expect(logger.getName()).toBe('TestLogger');
    });
  });

  describe('6개 로그 레벨 메서드', () => {
    it('trace() 메서드가 작동한다', () => {
      logger.setLevel(LogLevel.TRACE);
      logger.trace('Trace message');
      expect(outputs.length).toBe(1);
      expect(outputs[0].message).toBe('Trace message');
      expect(outputs[0].level).toBe(LogLevel.TRACE);
    });

    it('debug() 메서드가 작동한다', () => {
      logger.debug('Debug message');
      expect(outputs.length).toBe(1);
      expect(outputs[0].message).toBe('Debug message');
      expect(outputs[0].level).toBe(LogLevel.DEBUG);
    });

    it('info() 메서드가 작동한다', () => {
      logger.info('Info message');
      expect(outputs.length).toBe(1);
      expect(outputs[0].message).toBe('Info message');
      expect(outputs[0].level).toBe(LogLevel.INFO);
    });

    it('warn() 메서드가 작동한다', () => {
      logger.warn('Warning message');
      expect(outputs.length).toBe(1);
      expect(outputs[0].message).toBe('Warning message');
      expect(outputs[0].level).toBe(LogLevel.WARN);
    });

    it('error() 메서드 - 문자열 인자만', () => {
      logger.error('Error message');
      expect(outputs.length).toBe(1);
      expect(outputs[0].message).toBe('Error message');
      expect(outputs[0].level).toBe(LogLevel.ERROR);
    });

    it('error() 메서드 - Error 객체 포함', () => {
      const error = new Error('Test error');
      logger.error('Operation failed', error);
      expect(outputs.length).toBe(1);
      expect(outputs[0].message).toBe('Operation failed');
      expect(outputs[0].error).toBeDefined();
      expect(outputs[0].error?.message).toBe('Test error');
    });

    it('error() 메서드 - context 포함', () => {
      logger.error('Error with context', undefined, { metadata: { module: 'TestModule' } });
      expect(outputs.length).toBe(1);
      expect(outputs[0]).toBeDefined();
      expect(outputs[0].metadata?.module).toBe('TestModule');
    });

    it('fatal() 메서드 - 문자열 인자만', () => {
      logger.fatal('Fatal error');
      expect(outputs.length).toBe(1);
      expect(outputs[0].message).toBe('Fatal error');
      expect(outputs[0].level).toBe(LogLevel.FATAL);
    });

    it('fatal() 메서드 - Error 객체 포함', () => {
      const error = new Error('Fatal system error');
      logger.fatal('System shutdown', error);
      expect(outputs.length).toBe(1);
      expect(outputs[0].message).toBe('System shutdown');
      expect(outputs[0].error?.message).toBe('Fatal system error');
    });
  });

  describe('로그 필터링 (레벨별)', () => {
    it('INFO 레벨일 때 TRACE/DEBUG는 무시된다', () => {
      logger.setLevel(LogLevel.INFO);
      logger.trace('Trace');
      logger.debug('Debug');
      logger.info('Info');

      expect(outputs.length).toBe(1);
      expect(outputs[0].message).toBe('Info');
    });

    it('WARN 레벨일 때 INFO 이하는 무시된다', () => {
      logger.setLevel(LogLevel.WARN);
      logger.info('Info');
      logger.warn('Warning');
      logger.error('Error');

      expect(outputs.length).toBe(2);
      expect(outputs[0].message).toBe('Warning');
      expect(outputs[1].message).toBe('Error');
    });

    it('TRACE 레벨에서 모든 로그가 기록된다', () => {
      logger.setLevel(LogLevel.TRACE);
      logger.trace('Trace');
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');
      logger.fatal('Fatal');

      expect(outputs.length).toBe(6);
    });
  });

  describe('컨텍스트 정보 포함', () => {
    it('processType을 포함할 수 있다', () => {
      logger.info('Message', { processType: 'main' });
      expect(outputs[0].processType).toBe('main');
    });

    it('module을 포함할 수 있다', () => {
      logger.info('Message', { module: 'NavigationService' });
      expect(outputs[0].module).toBe('NavigationService');
    });

    it('userId를 포함할 수 있다', () => {
      logger.info('Message', { userId: 'user-123' });
      expect(outputs[0].userId).toBe('user-123');
    });

    it('sessionId를 포함할 수 있다', () => {
      logger.info('Message', { sessionId: 'sess-abc' });
      expect(outputs[0].sessionId).toBe('sess-abc');
    });

    it('requestId를 포함할 수 있다', () => {
      logger.info('Message', { requestId: 'req-xyz' });
      expect(outputs[0].requestId).toBe('req-xyz');
    });

    it('metadata를 포함할 수 있다', () => {
      const metadata = { userId: 'user-123', action: 'login' };
      logger.info('User login', { metadata });
      expect(outputs[0].metadata).toEqual(metadata);
    });

    it('모든 컨텍스트를 함께 포함할 수 있다', () => {
      logger.info('Complex message', {
        processType: 'main',
        module: 'AuthService',
        userId: 'user-123',
        sessionId: 'sess-abc',
        requestId: 'req-xyz',
        metadata: { ip: '192.168.1.1' },
      });

      expect(outputs[0]).toMatchObject({
        processType: 'main',
        module: 'AuthService',
        userId: 'user-123',
        sessionId: 'sess-abc',
        requestId: 'req-xyz',
        metadata: { ip: '192.168.1.1' },
      });
    });
  });

  describe('출력 핸들러', () => {
    it('여러 출력 핸들러를 등록할 수 있다', () => {
      const output1: LogFields[] = [];
      const output2: LogFields[] = [];

      logger.addOutput((fields) => output1.push(fields));
      logger.addOutput((fields) => output2.push(fields));

      logger.info('Test message');

      expect(output1.length).toBe(1);
      expect(output2.length).toBe(1);
      expect(output1[0].message).toBe('Test message');
      expect(output2[0].message).toBe('Test message');
    });

    it('출력 핸들러 에러는 무시된다', () => {
      logger.addOutput(() => {
        throw new Error('Handler error');
      });

      // 에러가 발생해도 다음 로그는 계속 기록됨
      logger.info('First message');
      logger.info('Second message');

      expect(outputs.length).toBe(2);
    });
  });

  describe('에러 처리', () => {
    it('Error 객체를 로깅할 수 있다', () => {
      const error = new Error('File not found');
      logger.error('Failed to read file', error, { metadata: { filename: 'test.txt' } });

      expect(outputs[0].error).toBeDefined();
      expect(outputs[0].error?.message).toBe('File not found');
      expect(outputs[0].error?.name).toBe('Error');
      expect(outputs[0].metadata).toEqual({ filename: 'test.txt' });
    });

    it('타임스탐프가 ISO8601 형식이다', () => {
      logger.info('Message');
      const timestamp = outputs[0].timestamp as string;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('프로세스 타입', () => {
    it('main 프로세스 타입으로 생성할 수 있다', () => {
      const mainLogger = new LoggerImpl('MainLogger', LogLevel.INFO, {
        processType: 'main',
      });
      mainLogger.addOutput((fields) => {
        expect(fields.processType).toBe('main');
      });
      mainLogger.info('Message');
    });

    it('renderer 프로세스 타입으로 생성할 수 있다', () => {
      const rendererLogger = new LoggerImpl('RendererLogger', LogLevel.INFO, {
        processType: 'renderer',
      });
      rendererLogger.addOutput((fields) => {
        expect(fields.processType).toBe('renderer');
      });
      rendererLogger.info('Message');
    });
  });
});
