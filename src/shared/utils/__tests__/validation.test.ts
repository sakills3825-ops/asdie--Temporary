/**
 * validation.ts 종합 테스트 스위트
 *
 * 테스트 대상:
 * - isValidUrl: URL 기본 검증
 * - validateUrl: URL 검증 + 프로토콜 화이트리스트
 * - isValidEmail: 이메일 검증
 * - isValidFilePath: 파일 경로 검증
 * - validateFilePath: 파일 경로 검증 + throw
 * - validateRequired: 필수 필드 검증
 * - validateRange: 숫자 범위 검증
 * - validateStringLength: 문자열 길이 검증
 *
 * 총 65개 테스트
 */

import {
  isValidUrl,
  validateUrl,
  isValidEmail,
  isValidFilePath,
  validateFilePath,
  validateRequired,
  validateRange,
  validateStringLength,
} from '../validation';
import { ValidationError } from '../../errors';

describe('validation.ts - 검증 유틸리티 테스트', () => {
  // ============================================
  // isValidUrl 테스트 (12개)
  // ============================================
  describe('isValidUrl()', () => {
    it('기본 HTTP: http://example.com', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('기본 HTTPS: https://example.com', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('경로 포함: https://example.com/path', () => {
      expect(isValidUrl('https://example.com/path')).toBe(true);
    });

    it('쿼리 포함: https://example.com?key=value', () => {
      expect(isValidUrl('https://example.com?key=value')).toBe(true);
    });

    it('프래그먼트: https://example.com#section', () => {
      expect(isValidUrl('https://example.com#section')).toBe(true);
    });

    it('포트 포함: https://example.com:8080', () => {
      expect(isValidUrl('https://example.com:8080')).toBe(true);
    });

    it('상대 URL: example.com (false)', () => {
      expect(isValidUrl('example.com')).toBe(false);
    });

    it('스키마 없음: //example.com (false)', () => {
      expect(isValidUrl('//example.com')).toBe(false);
    });

    it('잘못된 형식: ht!tp://example.com (false)', () => {
      expect(isValidUrl('ht!tp://example.com')).toBe(false);
    });

    it('공백 포함: https://example. com (false)', () => {
      expect(isValidUrl('https://example. com')).toBe(false);
    });

    it('빈 문자열: "" (false)', () => {
      expect(isValidUrl('')).toBe(false);
    });

    it('IPv6 URL: https://[::1]:8080', () => {
      expect(isValidUrl('https://[::1]:8080')).toBe(true);
    });
  });

  // ============================================
  // validateUrl 테스트 (16개)
  // ============================================
  describe('validateUrl()', () => {
    it('유효한 URL 통과: https://example.com', () => {
      const result = validateUrl('https://example.com');
      expect(result).toBe('https://example.com');
    });

    it('잘못된 URL throw: ValidationError', () => {
      expect(() => validateUrl('not a url')).toThrow(ValidationError);
    });

    it('허용 프로토콜 (http): http://example.com', () => {
      expect(validateUrl('http://example.com')).toBe('http://example.com');
    });

    it('허용 프로토콜 (https): https://example.com', () => {
      expect(validateUrl('https://example.com')).toBe('https://example.com');
    });

    it('허용 프로토콜 (file): file:///path/to/file', () => {
      expect(validateUrl('file:///path/to/file')).toBe('file:///path/to/file');
    });

    it('허용 프로토콜 (blob): blob:https://example.com/123', () => {
      expect(validateUrl('blob:https://example.com/123')).toBe('blob:https://example.com/123');
    });

    it('허용 프로토콜 (data): data:image/png;base64,iVBOR', () => {
      expect(validateUrl('data:image/png;base64,iVBOR')).toBe('data:image/png;base64,iVBOR');
    });

    it('금지 프로토콜 (ftp): ftp://example.com', () => {
      expect(() => validateUrl('ftp://example.com')).toThrow(ValidationError);
    });

    it('금지 프로토콜 (javascript): javascript:alert(1)', () => {
      expect(() => validateUrl('javascript:alert(1)')).toThrow(ValidationError);
    });

    it('금지 프로토콜 (gopher): gopher://example.com', () => {
      expect(() => validateUrl('gopher://example.com')).toThrow(ValidationError);
    });

    it('에러 메시지: 프로토콜 정보 포함', () => {
      expect(() => validateUrl('ftp://example.com')).toThrow('protocol not allowed');
    });

    it('IPv6 URL: https://[::1]:8080', () => {
      expect(validateUrl('https://[::1]:8080')).toBe('https://[::1]:8080');
    });

    it('IP 주소: https://192.168.1.1', () => {
      expect(validateUrl('https://192.168.1.1')).toBe('https://192.168.1.1');
    });

    it('localhost: http://localhost:3000', () => {
      expect(validateUrl('http://localhost:3000')).toBe('http://localhost:3000');
    });

    it('복잡한 경로: https://example.com/api/v1/users?id=123#results', () => {
      expect(validateUrl('https://example.com/api/v1/users?id=123#results')).toBe(
        'https://example.com/api/v1/users?id=123#results'
      );
    });

    it('Windows 파일 경로: file:///C:/Windows/System32', () => {
      expect(validateUrl('file:///C:/Windows/System32')).toBe('file:///C:/Windows/System32');
    });
  });

  // ============================================
  // isValidEmail 테스트 (10개)
  // ============================================
  describe('isValidEmail()', () => {
    it('기본 이메일: user@example.com', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
    });

    it('여러 도메인 레벨: user@mail.example.co.uk', () => {
      expect(isValidEmail('user@mail.example.co.uk')).toBe(true);
    });

    it('숫자 포함: user123@example.com', () => {
      expect(isValidEmail('user123@example.com')).toBe(true);
    });

    it('점 포함: first.last@example.com', () => {
      expect(isValidEmail('first.last@example.com')).toBe(true);
    });

    it('하이픈 포함: user-name@example.com', () => {
      expect(isValidEmail('user-name@example.com')).toBe(true);
    });

    it('공백 포함: user @example.com (false)', () => {
      expect(isValidEmail('user @example.com')).toBe(false);
    });

    it('@ 없음: userexample.com (false)', () => {
      expect(isValidEmail('userexample.com')).toBe(false);
    });

    it('@ 여러 개: user@@example.com (false)', () => {
      expect(isValidEmail('user@@example.com')).toBe(false);
    });

    it('매우 긴 이메일 (254자 이상): false', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(isValidEmail(longEmail)).toBe(false);
    });

    it('빈 문자열: "" (false)', () => {
      expect(isValidEmail('')).toBe(false);
    });
  });

  // ============================================
  // isValidFilePath 테스트 (10개)
  // ============================================
  describe('isValidFilePath()', () => {
    it('상대 경로: files/document.txt', () => {
      expect(isValidFilePath('files/document.txt')).toBe(true);
    });

    it('점 포함: ./files/document.txt', () => {
      expect(isValidFilePath('./files/document.txt')).toBe(true);
    });

    it('상위 디렉토리: ../parent/file.txt (false)', () => {
      expect(isValidFilePath('../parent/file.txt')).toBe(false);
    });

    it('상위 디렉토리 변형: file/../doc.txt (false)', () => {
      expect(isValidFilePath('file/../doc.txt')).toBe(false);
    });

    it('홈 매크로: ~/Documents/file.txt (false)', () => {
      expect(isValidFilePath('~/Documents/file.txt')).toBe(false);
    });

    it('절대 경로 (Unix): /etc/passwd (false)', () => {
      expect(isValidFilePath('/etc/passwd')).toBe(false);
    });

    it('절대 경로 (Windows): C:\\Windows\\System32 (false)', () => {
      expect(isValidFilePath('C:\\Windows\\System32')).toBe(false);
    });

    it('Windows UNC: \\\\server\\share\\file.txt (false)', () => {
      expect(isValidFilePath('\\\\server\\share\\file.txt')).toBe(false);
    });

    it('제어 문자: file\\x00.txt (false)', () => {
      expect(isValidFilePath('file\x00.txt')).toBe(false);
    });

    it('공백만: "   " (false)', () => {
      expect(isValidFilePath('   ')).toBe(false);
    });
  });

  // ============================================
  // validateFilePath 테스트 (6개)
  // ============================================
  describe('validateFilePath()', () => {
    it('유효한 경로 통과: files/doc.txt', () => {
      const result = validateFilePath('files/doc.txt');
      expect(result).toBe('files/doc.txt');
    });

    it('잘못된 경로 throw: ValidationError', () => {
      expect(() => validateFilePath('/etc/passwd')).toThrow(ValidationError);
    });

    it('에러 메시지 포함: 경로명 포함', () => {
      expect(() => validateFilePath('/etc/passwd')).toThrow('Invalid file path');
    });

    it('상위 디렉토리 거부: ../file.txt', () => {
      expect(() => validateFilePath('../file.txt')).toThrow(ValidationError);
    });

    it('절대 경로 거부: /home/user/file.txt', () => {
      expect(() => validateFilePath('/home/user/file.txt')).toThrow(ValidationError);
    });

    it('제어 문자 거부: file\x00.txt', () => {
      expect(() => validateFilePath('file\x00.txt')).toThrow(ValidationError);
    });
  });

  // ============================================
  // validateRequired 테스트 (4개)
  // ============================================
  describe('validateRequired()', () => {
    it('유효한 값 통과: "hello"', () => {
      const result = validateRequired('hello', 'username');
      expect(result).toBe('hello');
    });

    it('null 거부: null', () => {
      expect(() => validateRequired(null, 'username')).toThrow(ValidationError);
    });

    it('undefined 거부: undefined', () => {
      expect(() => validateRequired(undefined, 'username')).toThrow(ValidationError);
    });

    it('0 통과: 0은 valid', () => {
      const result = validateRequired(0, 'count');
      expect(result).toBe(0);
    });

    it('false 통과: false는 valid', () => {
      const result = validateRequired(false, 'flag');
      expect(result).toBe(false);
    });

    it('빈 문자열 통과: ""는 valid', () => {
      const result = validateRequired('', 'text');
      expect(result).toBe('');
    });
  });

  // ============================================
  // validateRange 테스트 (6개)
  // ============================================
  describe('validateRange()', () => {
    it('범위 내: value=5, min=0, max=10', () => {
      const result = validateRange(5, 0, 10, 'count');
      expect(result).toBe(5);
    });

    it('최소값: value=0, min=0, max=10', () => {
      const result = validateRange(0, 0, 10, 'count');
      expect(result).toBe(0);
    });

    it('최대값: value=10, min=0, max=10', () => {
      const result = validateRange(10, 0, 10, 'count');
      expect(result).toBe(10);
    });

    it('미만: value=-1, min=0, max=10 (throw)', () => {
      expect(() => validateRange(-1, 0, 10, 'count')).toThrow(ValidationError);
    });

    it('초과: value=11, min=0, max=10 (throw)', () => {
      expect(() => validateRange(11, 0, 10, 'count')).toThrow(ValidationError);
    });

    it('float 범위: value=5.5, min=0, max=10', () => {
      const result = validateRange(5.5, 0, 10, 'ratio');
      expect(result).toBe(5.5);
    });
  });

  // ============================================
  // validateStringLength 테스트 (7개)
  // ============================================
  describe('validateStringLength()', () => {
    it('정상 길이: length=5, min=2, max=10', () => {
      const result = validateStringLength('hello', 2, 10, 'text');
      expect(result).toBe('hello');
    });

    it('최소 길이: length=2, min=2, max=10', () => {
      const result = validateStringLength('hi', 2, 10, 'text');
      expect(result).toBe('hi');
    });

    it('최대 길이: length=10, min=2, max=10', () => {
      const result = validateStringLength('abcdefghij', 2, 10, 'text');
      expect(result).toBe('abcdefghij');
    });

    it('미만: length=1, min=2, max=10 (throw)', () => {
      expect(() => validateStringLength('a', 2, 10, 'text')).toThrow(ValidationError);
    });

    it('초과: length=11, min=2, max=10 (throw)', () => {
      expect(() => validateStringLength('abcdefghijk', 2, 10, 'text')).toThrow(
        ValidationError
      );
    });

    it('유니코드: 한글 3자', () => {
      const result = validateStringLength('한글글', 2, 10, 'text');
      expect(result).toBe('한글글');
    });

    it('이모지: 이모지 2개', () => {
      const result = validateStringLength('😊😊', 1, 5, 'emoji');
      expect(result).toBe('😊😊');
    });
  });
});
