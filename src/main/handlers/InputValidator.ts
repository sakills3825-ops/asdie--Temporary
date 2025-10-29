/**
 * InputValidator - IPC 핸들러 입력 검증
 *
 * 책임: IPC 요청에서 전달되는 입력값 검증
 * - URL 형식 검증
 * - 문자열 길이 제한
 * - 필수 필드 확인
 * - 타입 검증
 *
 * SRP 원칙: 입력 검증만 담당
 */

/**
 * URL 유효성 검증
 */
export function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:' || urlObj.protocol === 'file:';
  } catch {
    return false;
  }
}

/**
 * ID 형식 검증 (CUID 또는 UUID)
 */
export function validateId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  // CUID: c + 24-25 chars, UUID: 8-4-4-4-12 format
  const cuidRegex = /^c[a-z0-9]{24}$/;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return cuidRegex.test(id) || uuidRegex.test(id) || id.length > 0;
}

/**
 * 문자열 길이 검증
 */
export function validateStringLength(value: string, maxLength: number): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return value.length > 0 && value.length <= maxLength;
}

/**
 * 제목 문자열 검증
 */
export function validateTitle(title: string | undefined, maxLength: number = 500): boolean {
  if (title === undefined) {
    return true; // 선택사항
  }
  if (typeof title !== 'string') {
    return false;
  }
  return title.length <= maxLength;
}

/**
 * 폴더/카테고리 이름 검증
 */
export function validateFolderName(folderName: string, maxLength: number = 100): boolean {
  if (!folderName || typeof folderName !== 'string') {
    return false;
  }
  return folderName.length > 0 && folderName.length <= maxLength && !/[<>:"|?*]/.test(folderName);
}

/**
 * 검색 쿼리 검증
 */
export function validateSearchQuery(query: string, maxLength: number = 1000): boolean {
  if (!query || typeof query !== 'string') {
    return false;
  }
  return query.length > 0 && query.length <= maxLength;
}

/**
 * 제한값 검증 (limit 파라미터)
 */
export function validateLimit(limit: number, maxLimit: number = 1000): boolean {
  if (typeof limit !== 'number') {
    return false;
  }
  return limit > 0 && limit <= maxLimit;
}

/**
 * 타임스탐프 검증
 */
export function validateTimestamp(timestamp: number): boolean {
  if (typeof timestamp !== 'number') {
    return false;
  }
  // 1970년부터 2100년까지 유효한 타임스탐프
  return timestamp >= 0 && timestamp <= 4102444800000;
}

/**
 * 부울 값 검증
 */
export function validateBoolean(value: unknown): boolean {
  return typeof value === 'boolean' || value === undefined;
}

/**
 * 업데이트 객체 검증 (null이나 빈 객체 확인)
 */
export function validateUpdateObject(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  return Object.keys(obj).length > 0;
}

/**
 * 입력 검증 결과 타입
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * URL 검증 (에러 메시지 포함)
 */
export function validateUrlWithError(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL은 필수 항목입니다 (문자열)' };
  }
  if (!validateUrl(url)) {
    return { valid: false, error: 'URL 형식이 올바르지 않습니다' };
  }
  return { valid: true };
}

/**
 * ID 검증 (에러 메시지 포함)
 */
export function validateIdWithError(id: string, fieldName: string = 'ID'): ValidationResult {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: `${fieldName}은(는) 필수 항목입니다 (문자열)` };
  }
  if (!validateId(id)) {
    return { valid: false, error: `${fieldName} 형식이 올바르지 않습니다` };
  }
  return { valid: true };
}

/**
 * 제목 검증 (에러 메시지 포함)
 */
export function validateTitleWithError(title: string | undefined, maxLength: number = 500): ValidationResult {
  if (title === undefined) {
    return { valid: true }; // 선택사항
  }
  if (typeof title !== 'string') {
    return { valid: false, error: '제목은 문자열이어야 합니다' };
  }
  if (title.length > maxLength) {
    return { valid: false, error: `제목은 ${maxLength}자 이하여야 합니다` };
  }
  return { valid: true };
}

/**
 * 검색 쿼리 검증 (에러 메시지 포함)
 */
export function validateSearchQueryWithError(query: string, maxLength: number = 1000): ValidationResult {
  if (!query || typeof query !== 'string') {
    return { valid: false, error: '검색어는 필수 항목입니다 (문자열)' };
  }
  if (query.length > maxLength) {
    return { valid: false, error: `검색어는 ${maxLength}자 이하여야 합니다` };
  }
  return { valid: true };
}
