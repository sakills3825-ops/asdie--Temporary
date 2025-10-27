/**
 * 앱 전역 제한값 및 설정 상수
 *
 * UI/기능 제한, 타임아웃, 크기 제한 등 정의
 */

export const LIMITS = {
  // ===== 탭 관리 =====
  MAX_TABS: 100,
  MIN_TABS: 1,

  // ===== 히스토리 =====
  MAX_HISTORY_ITEMS: 10000,
  HISTORY_RETENTION_DAYS: 90,

  // ===== 북마크 =====
  MAX_BOOKMARKS: 5000,
  MAX_BOOKMARK_NAME_LENGTH: 255,

  // ===== 파일 =====
  MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB
  MAX_FILE_NAME_LENGTH: 255,

  // ===== URL =====
  MAX_URL_LENGTH: 2048,

  // ===== 성능 =====
  IPC_TIMEOUT_MS: 30000, // 30초
  NETWORK_TIMEOUT_MS: 60000, // 60초

  // ===== 줌 =====
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 3,
  DEFAULT_ZOOM: 1,
  ZOOM_STEP: 0.1,

  // ===== 로그 =====
  MAX_LOG_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_LOG_FILES: 5,
} as const;

export const DEBOUNCE_MS = {
  INPUT: 300,
  RESIZE: 200,
  SCROLL: 150,
  NAVIGATION: 500,
} as const;

export const CACHE_DURATION_MS = {
  TAB_METADATA: 60000, // 1분
  SETTINGS: 5 * 60000, // 5분
  BOOKMARK_LIST: 60000, // 1분
} as const;
