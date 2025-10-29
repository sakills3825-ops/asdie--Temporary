/**
 * IPC Args 검증 시스템
 * 
 * 목적:
 * - 모든 IPC 채널 핸들러에서 일관된 Args 검증
 * - 검증 규칙 재사용 (중복 제거)
 * - 검증 실패 시 상세한 에러 메시지
 * - 스키마 기반 선언적 검증
 * 
 * 설계:
 * - Args 스키마: 필수 필드, 선택 필드, 타입, 범위
 * - 검증 함수: 자동 생성 또는 커스텀
 * - 검증 결과: 성공/실패 + 상세 메시지
 * 
 * 사용 패턴:
 * ```typescript
 * const schema = createArgsSchema({
 *   url: { type: 'string', required: true },
 *   timeout: { type: 'number', required: false, min: 0, max: 60000 }
 * });
 * 
 * const result = validateArgs(args, schema);
 * if (!result.valid) {
 *   throw new ValidationError(result.errors);
 * }
 * ```
 */

// ============================================================================
// 검증 규칙 타입 정의
// ============================================================================

/**
 * 기본 타입
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/**
 * 필드 검증 규칙
 */
export interface FieldSchema {
  type: FieldType;
  required?: boolean; // 기본값: false
  nullable?: boolean; // 기본값: false
  minLength?: number; // string 타입 only
  maxLength?: number; // string 타입 only
  pattern?: RegExp; // string 타입 only
  min?: number; // number 타입 only
  max?: number; // number 타입 only
  enum?: unknown[]; // 열거형 값
  items?: FieldSchema; // array 타입 only (배열 요소 검증)
  properties?: Record<string, FieldSchema>; // object 타입 only (객체 구조 검증)
}

/**
 * Args 전체 스키마
 */
export type ArgsSchema = Record<string, FieldSchema>;

/**
 * 검증 결과
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * 개별 검증 에러
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

// ============================================================================
// 검증 함수
// ============================================================================

/**
 * 주어진 값이 타입과 일치하는지 확인
 */
function checkType(value: unknown, type: FieldType): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return false;
  }
}

/**
 * 문자열 길이 검증
 */
function validateString(
  value: string,
  field: string,
  schema: FieldSchema
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push({
      field,
      message: `String too short: minimum ${schema.minLength} characters (got ${value.length})`,
      value,
    });
  }

  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    errors.push({
      field,
      message: `String too long: maximum ${schema.maxLength} characters (got ${value.length})`,
      value,
    });
  }

  if (schema.pattern !== undefined && !schema.pattern.test(value)) {
    errors.push({
      field,
      message: `String does not match pattern: ${schema.pattern.source}`,
      value,
    });
  }

  return errors;
}

/**
 * 숫자 범위 검증
 */
function validateNumber(
  value: number,
  field: string,
  schema: FieldSchema
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (schema.min !== undefined && value < schema.min) {
    errors.push({
      field,
      message: `Number too small: minimum ${schema.min} (got ${value})`,
      value,
    });
  }

  if (schema.max !== undefined && value > schema.max) {
    errors.push({
      field,
      message: `Number too large: maximum ${schema.max} (got ${value})`,
      value,
    });
  }

  return errors;
}

/**
 * 배열 요소 검증
 */
function validateArray(
  value: unknown[],
  field: string,
  schema: FieldSchema
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!schema.items) {
    return errors; // 요소 검증 규칙 없음
  }

  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    const itemField = `${field}[${i}]`;

    // 타입 확인
    if (!checkType(item, schema.items.type)) {
      errors.push({
        field: itemField,
        message: `Expected ${schema.items.type}, got ${typeof item}`,
        value: item,
      });
      continue;
    }

    // 타입별 검증
    if (schema.items.type === 'string') {
      errors.push(...validateString(item as string, itemField, schema.items));
    } else if (schema.items.type === 'number') {
      errors.push(...validateNumber(item as number, itemField, schema.items));
    } else if (schema.items.type === 'object' && schema.items.properties) {
      errors.push(
        ...validateObject(item as Record<string, unknown>, itemField, schema.items)
      );
    }
  }

  return errors;
}

/**
 * 객체 구조 검증
 */
function validateObject(
  value: Record<string, unknown>,
  field: string,
  schema: FieldSchema
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!schema.properties) {
    return errors; // 구조 검증 규칙 없음
  }

  for (const [key, fieldSchema] of Object.entries(schema.properties)) {
    const fieldPath = `${field}.${key}`;
    const fieldValue = value[key];

    // 필수 필드 확인
    if (fieldSchema.required && fieldValue === undefined) {
      errors.push({
        field: fieldPath,
        message: 'Required field missing',
      });
      continue;
    }

    // 값이 없으면 skip (선택 필드)
    if (fieldValue === undefined) {
      continue;
    }

    // null 확인
    if (fieldValue === null) {
      if (!fieldSchema.nullable) {
        errors.push({
          field: fieldPath,
          message: 'Field cannot be null',
          value: fieldValue,
        });
      }
      continue;
    }

    // 타입 확인
    if (!checkType(fieldValue, fieldSchema.type)) {
      errors.push({
        field: fieldPath,
        message: `Expected ${fieldSchema.type}, got ${typeof fieldValue}`,
        value: fieldValue,
      });
      continue;
    }

    // 열거형 확인
    if (fieldSchema.enum && !fieldSchema.enum.includes(fieldValue)) {
      errors.push({
        field: fieldPath,
        message: `Value not in enum: ${JSON.stringify(fieldSchema.enum)}`,
        value: fieldValue,
      });
      continue;
    }

    // 타입별 검증
    if (fieldSchema.type === 'string') {
      errors.push(...validateString(fieldValue as string, fieldPath, fieldSchema));
    } else if (fieldSchema.type === 'number') {
      errors.push(...validateNumber(fieldValue as number, fieldPath, fieldSchema));
    } else if (fieldSchema.type === 'array') {
      errors.push(...validateArray(fieldValue as unknown[], fieldPath, fieldSchema));
    } else if (fieldSchema.type === 'object' && fieldSchema.properties) {
      errors.push(
        ...validateObject(fieldValue as Record<string, unknown>, fieldPath, fieldSchema)
      );
    }
  }

  return errors;
}

// ============================================================================
// 공개 검증 API
// ============================================================================

/**
 * Args 검증
 * 
 * @param args - 검증할 Args 객체
 * @param schema - 검증 스키마
 * @returns 검증 결과 (valid + 에러 배열)
 */
export function validateArgs(
  args: unknown,
  schema: ArgsSchema
): ValidationResult {
  const errors: ValidationError[] = [];

  // Args가 객체인지 확인
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return {
      valid: false,
      errors: [
        {
          field: 'root',
          message: 'Args must be an object',
          value: args,
        },
      ],
    };
  }

  const argsObj = args as Record<string, unknown>;

  // 각 필드 검증
  for (const [field, fieldSchema] of Object.entries(schema)) {
    const value = argsObj[field];

    // 필수 필드
    if (fieldSchema.required && value === undefined) {
      errors.push({
        field,
        message: 'Required field missing',
      });
      continue;
    }

    // 선택 필드가 없으면 skip
    if (value === undefined) {
      continue;
    }

    // null 확인
    if (value === null) {
      if (!fieldSchema.nullable) {
        errors.push({
          field,
          message: 'Field cannot be null',
          value,
        });
      }
      continue;
    }

    // 열거형 확인
    if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
      errors.push({
        field,
        message: `Value not in enum: ${JSON.stringify(fieldSchema.enum)}`,
        value,
      });
      continue;
    }

    // 타입 확인
    if (!checkType(value, fieldSchema.type)) {
      errors.push({
        field,
        message: `Expected ${fieldSchema.type}, got ${typeof value}`,
        value,
      });
      continue;
    }

    // 타입별 상세 검증
    if (fieldSchema.type === 'string') {
      errors.push(...validateString(value as string, field, fieldSchema));
    } else if (fieldSchema.type === 'number') {
      errors.push(...validateNumber(value as number, field, fieldSchema));
    } else if (fieldSchema.type === 'array') {
      errors.push(...validateArray(value as unknown[], field, fieldSchema));
    } else if (fieldSchema.type === 'object' && fieldSchema.properties) {
      errors.push(...validateObject(value as Record<string, unknown>, field, fieldSchema));
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 검증 결과를 에러 메시지 문자열로 변환
 * 
 * @param result - 검증 결과
 * @returns 포맷된 에러 메시지
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.valid) {
    return '';
  }

  const lines = result.errors.map(
    (err) =>
      `  • ${err.field}: ${err.message}${
        err.value !== undefined ? ` (got: ${JSON.stringify(err.value)})` : ''
      }`
  );

  return `Validation failed:\n${lines.join('\n')}`;
}

// ============================================================================
// 자주 사용되는 스키마 패턴 (빌더)
// ============================================================================

/**
 * URL Args 스키마 빌더
 */
export const UrlSchema: FieldSchema = {
  type: 'string',
  required: true,
  minLength: 1,
  maxLength: 2048, // RFC 7231
  pattern: /^https?:\/\//,
};

/**
 * ID Args 스키마 빌더
 */
export function createIdSchema(maxLength = 255): FieldSchema {
  return {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength,
    pattern: /^[a-zA-Z0-9\-_]{1,}$/,
  };
}

/**
 * 쿼리 문자열 스키마 빌더
 */
export function createQuerySchema(maxLength = 500): FieldSchema {
  return {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength,
  };
}

/**
 * 선택적 URL 스키마 빌더
 */
export const OptionalUrlSchema: FieldSchema = {
  type: 'string',
  required: false,
  minLength: 1,
  maxLength: 2048,
  pattern: /^https?:\/\//,
};
