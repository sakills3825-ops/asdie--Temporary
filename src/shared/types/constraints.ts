/**
 * 타입 제약 조건 (Type Constraints)
 * 
 * 직렬화 가능한 타입, Branded Types 등 타입 안전성 보장.
 */

// ============================================================================
// 직렬화 가능한 타입 (Serializable Types)
// ============================================================================

/**
 * JSON으로 직렬화 가능한 기본 타입
 * 
 * IPC 전송, localStorage, IndexedDB 등에 안전하게 저장 가능한 타입.
 * Function, Symbol, undefined, 순환 참조 등 제외.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * JSON 객체 (재귀적 정의)
 */
export type JsonObject = {
  [key: string]: JsonValue;
};

/**
 * JSON 배열
 */
export type JsonArray = JsonValue[];

/**
 * JSON으로 직렬화 가능한 모든 값
 */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * 직렬화 가능한 타입 (별칭)
 * 
 * @example
 * ```typescript
 * // 올바른 사용
 * const data: Serializable = { name: 'Alice', age: 30 };
 * 
 * // 컴파일 에러
 * const bad: Serializable = { fn: () => {} }; // Function 불가
 * const bad2: Serializable = { sym: Symbol('x') }; // Symbol 불가
 * ```
 */
export type Serializable = JsonValue;

/**
 * 직렬화 가능한 Record
 * 
 * @example
 * ```typescript
 * const context: SerializableRecord = {
 *   userId: '123',
 *   timestamp: Date.now(),
 *   metadata: { action: 'login' }
 * };
 * ```
 */
export type SerializableRecord = Record<string, Serializable>;

// ============================================================================
// Branded Types (명목적 타이핑)
// ============================================================================

/**
 * Branded Type 기반 (Nominal Typing)
 * 
 * 같은 string이라도 의미적으로 다른 타입임을 컴파일러에게 알려줌.
 * 
 * @see https://basarat.gitbook.io/typescript/main-1/nominaltyping
 */
declare const __brand: unique symbol;

/**
 * Brand 타입 헬퍼
 */
type Brand<T, TBrand extends string> = T & { readonly [__brand]: TBrand };

/**
 * 탭 ID (고유 식별자)
 * 
 * @example
 * ```typescript
 * const tabId = 'tab-123' as TabId;
 * const userId = 'user-456' as UserId;
 * 
 * // 컴파일 에러: TabId와 UserId는 다른 타입!
 * deleteTab(userId); // ← 타입 에러
 * ```
 */
export type TabId = Brand<string, 'TabId'>;

/**
 * 사용자 ID
 */
export type UserId = Brand<string, 'UserId'>;

/**
 * 히스토리 ID
 */
export type HistoryId = Brand<string, 'HistoryId'>;

/**
 * 북마크 ID
 */
export type BookmarkId = Brand<string, 'BookmarkId'>;

/**
 * 윈도우 ID
 */
export type WindowId = Brand<number, 'WindowId'>;

/**
 * IPC 채널 이름 (타입 안전성)
 * 
 * @example
 * ```typescript
 * const channel = 'user:login' as ChannelName;
 * ipcRenderer.invoke(channel, data);
 * ```
 */
export type ChannelName = Brand<string, 'ChannelName'>;

/**
 * 파일 경로 (검증된 경로)
 * 
 * @example
 * ```typescript
 * // 검증 후 Branded Type으로 변환
 * function validatePath(path: string): FilePath {
 *   if (path.includes('..')) throw new Error('Path traversal');
 *   return path as FilePath;
 * }
 * ```
 */
export type FilePath = Brand<string, 'FilePath'>;

/**
 * URL (검증된 URL)
 */
export type ValidatedUrl = Brand<string, 'ValidatedUrl'>;

/**
 * 타임스탬프 (밀리초, Unix epoch)
 */
export type Timestamp = Brand<number, 'Timestamp'>;

// ============================================================================
// Branded Type 생성 헬퍼
// ============================================================================

/**
 * TabId 생성
 */
export function createTabId(id: string): TabId {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid tab ID');
  }
  return id as TabId;
}

/**
 * UserId 생성
 */
export function createUserId(id: string): UserId {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid user ID');
  }
  return id as UserId;
}

/**
 * HistoryId 생성
 */
export function createHistoryId(id: string): HistoryId {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid history ID');
  }
  return id as HistoryId;
}

/**
 * BookmarkId 생성
 */
export function createBookmarkId(id: string): BookmarkId {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid bookmark ID');
  }
  return id as BookmarkId;
}

/**
 * WindowId 생성
 */
export function createWindowId(id: number): WindowId {
  if (typeof id !== 'number' || id < 0) {
    throw new Error('Invalid window ID');
  }
  return id as WindowId;
}

/**
 * ChannelName 생성
 */
export function createChannelName(name: string): ChannelName {
  if (!name || typeof name !== 'string') {
    throw new Error('Invalid channel name');
  }
  return name as ChannelName;
}

/**
 * FilePath 생성 (간단한 검증)
 */
export function createFilePath(path: string): FilePath {
  if (!path || typeof path !== 'string') {
    throw new Error('Invalid file path');
  }
  // 경로 탈출 시도 감지
  if (path.includes('..')) {
    throw new Error('Path traversal detected');
  }
  return path as FilePath;
}

/**
 * ValidatedUrl 생성
 */
export function createValidatedUrl(url: string): ValidatedUrl {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL');
  }
  // URL 형식 검증
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }
  return url as ValidatedUrl;
}

/**
 * Timestamp 생성
 */
export function createTimestamp(ms?: number): Timestamp {
  const time = ms ?? Date.now();
  if (typeof time !== 'number' || time < 0) {
    throw new Error('Invalid timestamp');
  }
  return time as Timestamp;
}

// ============================================================================
// Branded Type 추출 헬퍼
// ============================================================================

/**
 * Branded Type을 원시 타입으로 변환
 * 
 * @example
 * ```typescript
 * const tabId: TabId = createTabId('tab-123');
 * const raw: string = unwrapBrand(tabId); // 'tab-123'
 * ```
 */
export function unwrapBrand<T>(branded: Brand<T, string>): T {
  return branded as T;
}

// ============================================================================
// 타입 검증 헬퍼
// ============================================================================

/**
 * 값이 직렬화 가능한지 검증
 * 
 * @param value 검증할 값
 * @returns 직렬화 가능 여부
 * 
 * @example
 * ```typescript
 * isSerializable({ name: 'Alice' }); // true
 * isSerializable({ fn: () => {} }); // false
 * isSerializable({ sym: Symbol('x') }); // false
 * ```
 */
export function isSerializable(value: unknown): value is Serializable {
  if (value === null) return true;
  if (value === undefined) return false;

  const type = typeof value;

  // Primitive types
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return true;
  }

  // Function, Symbol 제외
  if (type === 'function' || type === 'symbol') {
    return false;
  }

  // Array
  if (Array.isArray(value)) {
    return value.every(isSerializable);
  }

  // Object
  if (type === 'object') {
    // Date, RegExp 등 제외 (toJSON()이 있으면 허용 가능)
    if (value instanceof Date || value instanceof RegExp) {
      return false;
    }

    // Plain object만 허용
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype) {
      return false;
    }

    // 모든 프로퍼티 검증
    return Object.values(value).every(isSerializable);
  }

  return false;
}

/**
 * 값을 직렬화 가능한 타입으로 강제 변환
 * 
 * @param value 변환할 값
 * @returns 직렬화 가능한 값 (불가능하면 에러)
 * 
 * @throws {Error} 직렬화 불가능한 값일 경우
 */
export function ensureSerializable(value: unknown): Serializable {
  if (!isSerializable(value)) {
    throw new Error(`Value is not serializable: ${typeof value}`);
  }
  return value;
}

/**
 * 객체의 모든 값이 직렬화 가능한지 검증
 * 
 * @param obj 검증할 객체
 * @returns 직렬화 가능 여부
 */
export function isSerializableRecord(obj: unknown): obj is SerializableRecord {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  return Object.values(obj).every(isSerializable);
}
