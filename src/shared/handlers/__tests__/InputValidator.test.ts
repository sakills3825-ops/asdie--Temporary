/**
 * InputValidator 테스트
 *
 * 책임: 모든 검증 함수의 단위 테스트
 * - URL 검증 (HTTP, HTTPS, file)
 * - ID 검증 (CUID, UUID)
 * - 제목/폴더명 검증 (길이, 특수문자)
 * - 검색어 검증
 * - Limit 검증 범위
 */

import { describe, it, expect } from 'vitest';
import {
  validateUrl,
  validateId,
  validateTitle,
  validateFolderName,
  validateSearchQuery,
  validateLimit,
  validateTimestamp,
  validateUrlWithError,
  validateIdWithError,
  validateTitleWithError,
  validateSearchQueryWithError,
} from '../../utils/InputValidator';

describe('InputValidator - URL 검증', () => {
  it('HTTP URL을 허용해야 함', () => {
    expect(validateUrl('http://example.com')).toBe(true);
  });

  it('HTTPS URL을 허용해야 함', () => {
    expect(validateUrl('https://example.com')).toBe(true);
  });

  it('file:// URL을 허용해야 함', () => {
    expect(validateUrl('file:///path/to/file')).toBe(true);
  });

  it('유효하지 않은 프로토콜은 거절해야 함', () => {
    expect(validateUrl('ftp://example.com')).toBe(false);
  });

  it('빈 문자열은 거절해야 함', () => {
    expect(validateUrl('')).toBe(false);
  });

  it('URL이 아닌 텍스트는 거절해야 함', () => {
    expect(validateUrl('just text')).toBe(false);
  });

  it('validateUrlWithError는 에러 메시지를 포함해야 함', () => {
    const result = validateUrlWithError('invalid');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('URL');
  });
});

describe('InputValidator - ID 검증', () => {
  it('CUID 형식을 허용해야 함', () => {
    // CUID는 c로 시작하는 25자 문자열
    expect(validateId('clkh0a21k0000qz8z0z0z0z0z')).toBe(true);
  });

  it('UUID 형식을 허용해야 함', () => {
    expect(validateId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('유효하지 않은 형식은 거절해야 함', () => {
    expect(validateId('invalid-id')).toBe(false);
  });

  it('빈 문자열은 거절해야 함', () => {
    expect(validateId('')).toBe(false);
  });

  it('validateIdWithError는 필드명을 포함해야 함', () => {
    const result = validateIdWithError('invalid', 'TabID');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('TabID');
  });
});

describe('InputValidator - 제목 검증', () => {
  it('유효한 제목을 허용해야 함', () => {
    expect(validateTitle('My Website Title', 500)).toBe(true);
  });

  it('최대 길이 제목을 허용해야 함', () => {
    const maxTitle = 'a'.repeat(500);
    expect(validateTitle(maxTitle, 500)).toBe(true);
  });

  it('최대 길이 초과는 거절해야 함', () => {
    const tooLongTitle = 'a'.repeat(501);
    expect(validateTitle(tooLongTitle, 500)).toBe(false);
  });

  it('비어있는 제목은 거절해야 함', () => {
    expect(validateTitle('', 500)).toBe(false);
  });

  it('undefined는 선택적이므로 true여야 함', () => {
    const result = validateTitleWithError(undefined, 500);
    expect(result.valid).toBe(true);
  });

  it('validateTitleWithError는 길이 제한을 나타내야 함', () => {
    const longTitle = 'a'.repeat(501);
    const result = validateTitleWithError(longTitle, 500);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('500');
  });
});

describe('InputValidator - 폴더명 검증', () => {
  it('유효한 폴더명을 허용해야 함', () => {
    expect(validateFolderName('MyFolder')).toBe(true);
  });

  it('숫자와 언더스코어를 허용해야 함', () => {
    expect(validateFolderName('My_Folder_123')).toBe(true);
  });

  it('하이픈을 허용해야 함', () => {
    expect(validateFolderName('my-folder')).toBe(true);
  });

  it('특수문자 < > : " | ? *는 거절해야 함', () => {
    expect(validateFolderName('My<Folder')).toBe(false);
    expect(validateFolderName('My:Folder')).toBe(false);
    expect(validateFolderName('My"Folder')).toBe(false);
    expect(validateFolderName('My|Folder')).toBe(false);
    expect(validateFolderName('My?Folder')).toBe(false);
    expect(validateFolderName('My*Folder')).toBe(false);
  });

  it('비어있는 폴더명은 거절해야 함', () => {
    expect(validateFolderName('')).toBe(false);
  });
});

describe('InputValidator - 검색어 검증', () => {
  it('유효한 검색어를 허용해야 함', () => {
    expect(validateSearchQuery('example query')).toBe(true);
  });

  it('최대 길이 검색어를 허용해야 함', () => {
    const maxQuery = 'a'.repeat(1000);
    expect(validateSearchQuery(maxQuery, 1000)).toBe(true);
  });

  it('최대 길이 초과는 거절해야 함', () => {
    const tooLongQuery = 'a'.repeat(1001);
    expect(validateSearchQuery(tooLongQuery, 1000)).toBe(false);
  });

  it('비어있는 검색어는 거절해야 함', () => {
    expect(validateSearchQuery('')).toBe(false);
  });

  it('validateSearchQueryWithError는 에러 메시지를 포함해야 함', () => {
    const result = validateSearchQueryWithError('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('검색어');
  });
});

describe('InputValidator - Limit 검증', () => {
  it('유효한 limit을 허용해야 함', () => {
    expect(validateLimit(50, 1000)).toBe(true);
  });

  it('최대값을 허용해야 함', () => {
    expect(validateLimit(1000, 1000)).toBe(true);
  });

  it('0은 거절해야 함', () => {
    expect(validateLimit(0, 1000)).toBe(false);
  });

  it('음수는 거절해야 함', () => {
    expect(validateLimit(-1, 1000)).toBe(false);
  });

  it('최대값 초과는 거절해야 함', () => {
    expect(validateLimit(1001, 1000)).toBe(false);
  });

  it('숫자가 아닌 값은 거절해야 함', () => {
    expect(validateLimit('50' as any, 1000)).toBe(false);
  });
});

describe('InputValidator - 타임스탐프 검증', () => {
  it('유효한 타임스탐프를 허용해야 함', () => {
    const now = Date.now();
    expect(validateTimestamp(now)).toBe(true);
  });

  it('과거 타임스탐프를 허용해야 함', () => {
    const pastTime = Date.now() - 1000 * 60 * 60 * 24; // 1일 전
    expect(validateTimestamp(pastTime)).toBe(true);
  });

  it('미래 타임스탐프를 허용해야 함', () => {
    const futureTime = Date.now() + 1000 * 60 * 60 * 24; // 1일 후
    expect(validateTimestamp(futureTime)).toBe(true);
  });

  it('음수는 거절해야 함', () => {
    expect(validateTimestamp(-1)).toBe(false);
  });

  it('숫자가 아닌 값은 거절해야 함', () => {
    expect(validateTimestamp('12345' as any)).toBe(false);
  });
});

describe('InputValidator - 통합 검증', () => {
  it('유효한 탭 생성 요청을 모두 통과해야 함', () => {
    const url = 'https://example.com';
    const title = 'My Page';

    expect(validateUrl(url)).toBe(true);
    expect(validateTitle(title, 500)).toBe(true);
  });

  it('유효한 북마크 생성 요청을 모두 통과해야 함', () => {
    const url = 'https://example.com';
    const title = 'My Bookmark';
    const folder = 'MyFolder';

    expect(validateUrl(url)).toBe(true);
    expect(validateTitle(title, 500)).toBe(true);
    expect(validateFolderName(folder)).toBe(true);
  });

  it('유효한 검색 요청을 모두 통과해야 함', () => {
    const query = 'search term';
    const limit = 50;

    expect(validateSearchQuery(query)).toBe(true);
    expect(validateLimit(limit, 1000)).toBe(true);
  });
});
