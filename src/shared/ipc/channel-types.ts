/**
 * IPC 채널 타입 맵핑 (채널별 Args/Response 타입 정의)
 * 
 * 목적: 각 채널의 입력/출력 타입을 명시적으로 정의
 * - invoke() 호출 시 타입 검증
 * - 채널 핸들러 구현 시 타입 보장
 * - Args 구조 및 Response 타입 자동완성
 * 
 * 설계:
 * - 채널명은 IPC_CHANNELS 상수와 동기화
 * - Args는 직렬화 가능한 타입만 (SerializableRecord)
 * - Response도 직렬화 가능한 타입만
 * - never 사용으로 args/response 선택적 표현
 */

import type { SerializableRecord } from '../types/constraints';

// ============================================================================
// 브라우저 네비게이션
// ============================================================================

/** 브라우저: URL로 이동 */
export interface BrowserNavigateToArgs {
  url: string;
  target?: '_blank' | '_self';
}
export type BrowserNavigateToResponse = {
  success: boolean;
  tabId?: string;
};

/** 브라우저: 뒤로 가기 */
export type BrowserGoBackArgs = never; // args 없음
export type BrowserGoBackResponse = boolean;

/** 브라우저: 앞으로 가기 */
export type BrowserGoForwardArgs = never;
export type BrowserGoForwardResponse = boolean;

/** 브라우저: 새로고침 */
export interface BrowserReloadArgs {
  tabId?: string;
}
export type BrowserReloadResponse = boolean;

/** 브라우저: 새로고침 (캐시 무시) */
export interface BrowserReloadIgnoreCacheArgs {
  tabId?: string;
}
export type BrowserReloadIgnoreCacheResponse = boolean;

/** 브라우저: 페이지 로드 중지 */
export interface BrowserStopArgs {
  tabId?: string;
}
export type BrowserStopResponse = boolean;

/** 브라우저: 확대 */
export interface BrowserZoomInArgs {
  tabId?: string;
  level?: number;
}
export type BrowserZoomInResponse = number;

/** 브라우저: 축소 */
export interface BrowserZoomOutArgs {
  tabId?: string;
  level?: number;
}
export type BrowserZoomOutResponse = number;

/** 브라우저: 기본 줌 */
export interface BrowserZoomResetArgs {
  tabId?: string;
}
export type BrowserZoomResetResponse = number;

/** 브라우저: 페이지 내 검색 */
export interface BrowserFindInPageArgs {
  query: string;
  options?: {
    matchCase?: boolean;
    findNext?: boolean;
  };
}
export type BrowserFindInPageResponse = {
  requestId: number;
  activeMatchOrdinal: number;
  matches: number;
};

/** 브라우저: 인쇄 */
export interface BrowserPrintArgs {
  tabId?: string;
  options?: SerializableRecord;
}
export type BrowserPrintResponse = boolean;

/** 브라우저: 개발자 도구 */
export interface BrowserDevToolsArgs {
  tabId?: string;
}
export type BrowserDevToolsResponse = boolean;

// ============================================================================
// 탭 관리
// ============================================================================

/** 탭: 새 탭 생성 */
export interface TabCreateNewArgs {
  url?: string;
  background?: boolean;
}
export type TabCreateNewResponse = {
  tabId: string;
  windowId: string;
};

/** 탭: 탭 닫기 */
export interface TabCloseArgs {
  tabId: string;
}
export type TabCloseResponse = boolean;

/** 탭: 탭 선택 */
export interface TabSelectArgs {
  tabId: string;
}
export type TabSelectResponse = boolean;

/** 탭: 탭 정보 업데이트 */
export interface TabUpdateArgs {
  tabId: string;
  url?: string;
  title?: string;
  favicon?: string;
}
export type TabUpdateResponse = {
  tabId: string;
  updated: boolean;
};

/** 탭: 모든 탭 조회 */
export type TabGetAllArgs = never;
export type TabGetAllResponse = Array<{
  tabId: string;
  windowId: string;
  url: string;
  title: string;
  active: boolean;
}>;

/** 탭: 탭 복제 */
export interface TabDuplicateArgs {
  tabId: string;
  background?: boolean;
}
export type TabDuplicateResponse = {
  tabId: string;
};

/** 탭: 탭 음소거 */
export interface TabMuteArgs {
  tabId: string;
}
export type TabMuteResponse = boolean;

/** 탭: 탭 고정 */
export interface TabPinArgs {
  tabId: string;
  pinned: boolean;
}
export type TabPinResponse = boolean;

// ============================================================================
// 히스토리 관리
// ============================================================================

/** 히스토리: 항목 추가 */
export interface HistoryAddArgs {
  url: string;
  title?: string;
  timestamp?: number;
}
export type HistoryAddResponse = {
  historyId: string;
};

/** 히스토리: 모든 항목 조회 */
export interface HistoryGetAllArgs {
  limit?: number;
  offset?: number;
}
export type HistoryGetAllResponse = Array<{
  historyId: string;
  url: string;
  title: string;
  timestamp: number;
  visitCount: number;
}>;

/** 히스토리: 검색 */
export interface HistorySearchArgs {
  query: string;
  limit?: number;
}
export type HistorySearchResponse = Array<{
  historyId: string;
  url: string;
  title: string;
  timestamp: number;
  matchType: 'url' | 'title';
}>;

/** 히스토리: 특정 항목 삭제 */
export interface HistoryDeleteArgs {
  historyId: string;
}
export type HistoryDeleteResponse = boolean;

/** 히스토리: 모든 항목 삭제 */
export type HistoryClearArgs = never;
export type HistoryClearResponse = boolean;

// ============================================================================
// 북마크 관리
// ============================================================================

/** 북마크: 북마크 추가 */
export interface BookmarkAddArgs {
  url: string;
  title: string;
  folderId?: string;
}
export type BookmarkAddResponse = {
  bookmarkId: string;
};

/** 북마크: 북마크 삭제 */
export interface BookmarkRemoveArgs {
  bookmarkId: string;
}
export type BookmarkRemoveResponse = boolean;

/** 북마크: 모든 북마크 조회 */
export type BookmarkGetAllArgs = never;
export type BookmarkGetAllResponse = Array<{
  bookmarkId: string;
  url: string;
  title: string;
  folderId?: string;
}>;

/** 북마크: 북마크 검색 */
export interface BookmarkSearchArgs {
  query: string;
  limit?: number;
}
export type BookmarkSearchResponse = Array<{
  bookmarkId: string;
  url: string;
  title: string;
}>;

/** 북마크: 폴더 생성 */
export interface BookmarkCreateFolderArgs {
  name: string;
  parentId?: string;
}
export type BookmarkCreateFolderResponse = {
  folderId: string;
};

/** 북마크: 폴더 업데이트 */
export interface BookmarkUpdateFolderArgs {
  folderId: string;
  name: string;
}
export type BookmarkUpdateFolderResponse = boolean;

// ============================================================================
// 설정 관리
// ============================================================================

/** 설정: 특정 설정값 조회 */
export interface SettingsGetArgs {
  key: string;
}
export type SettingsGetResponse = {
  key: string;
  value: string | number | boolean | null;
};

/** 설정: 모든 설정값 조회 */
export type SettingsGetAllArgs = never;
export type SettingsGetAllResponse = SerializableRecord;

/** 설정: 설정값 저장 */
export interface SettingsSetArgs {
  key: string;
  value: string | number | boolean | null;
}
export type SettingsSetResponse = boolean;

/** 설정: 설정 초기화 */
export type SettingsResetArgs = never;
export type SettingsResetResponse = boolean;

/** 설정: 테마 조회 */
export type SettingsGetThemeArgs = never;
export type SettingsGetThemeResponse = {
  theme: 'light' | 'dark' | 'auto';
};

/** 설정: 테마 설정 */
export interface SettingsSetThemeArgs {
  theme: 'light' | 'dark' | 'auto';
}
export type SettingsSetThemeResponse = boolean;

// ============================================================================
// 파일 작업
// ============================================================================

/** 파일: 파일 열기 */
export interface FileOpenArgs {
  path: string;
  encoding?: 'utf8' | 'utf16le' | 'base64';
}
export type FileOpenResponse = {
  content: string;
  size: number;
  mtime: number;
};

/** 파일: 파일 저장 */
export interface FileSaveArgs {
  path: string;
  content: string;
  encoding?: 'utf8' | 'utf16le' | 'base64';
}
export type FileSaveResponse = boolean;

/** 파일: 파일 다운로드 */
export interface FileDownloadArgs {
  url: string;
  directory?: string;
}
export type FileDownloadResponse = {
  filePath: string;
  size: number;
};

/** 파일: 파일 열기 대화상자 */
export interface FileOpenDialogArgs {
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  multiSelect?: boolean;
}
export type FileOpenDialogResponse = {
  filePaths: string[];
  canceled: boolean;
};

/** 파일: 파일 저장 대화상자 */
export interface FileSaveDialogArgs {
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}
export type FileSaveDialogResponse = {
  filePath: string;
  canceled: boolean;
};

// ============================================================================
// 윈도우 제어
// ============================================================================

/** 윈도우: 최소화 */
export type WindowMinimizeArgs = never;
export type WindowMinimizeResponse = boolean;

/** 윈도우: 최대화 */
export type WindowMaximizeArgs = never;
export type WindowMaximizeResponse = boolean;

/** 윈도우: 복원 */
export type WindowRestoreArgs = never;
export type WindowRestoreResponse = boolean;

/** 윈도우: 닫기 */
export type WindowCloseArgs = never;
export type WindowCloseResponse = boolean;

/** 윈도우: 전체화면 토글 */
export type WindowToggleFullscreenArgs = never;
export type WindowToggleFullscreenResponse = boolean;

/** 윈도우: 개발자 도구 토글 */
export type WindowToggleDevToolsArgs = never;
export type WindowToggleDevToolsResponse = boolean;

// ============================================================================
// 앱 제어
// ============================================================================

/** 앱: 종료 */
export type AppExitArgs = never;
export type AppExitResponse = never; // 응답 없음 (앱 종료)

/** 앱: 버전 정보 조회 */
export type AppGetVersionArgs = never;
export type AppGetVersionResponse = {
  version: string;
  buildNumber: string;
  platform: string;
};

/** 앱: 업데이트 확인 */
export type AppCheckUpdateArgs = never;
export type AppCheckUpdateResponse = {
  available: boolean;
  newVersion?: string;
  downloadUrl?: string;
};

/** 앱: 앱 재시작 */
export type AppRestartArgs = never;
export type AppRestartResponse = never; // 응답 없음 (앱 재시작)

/** 앱: 시스템 정보 조회 */
export type AppGetSystemInfoArgs = never;
export type AppGetSystemInfoResponse = {
  arch: string;
  platform: string;
  cpuCount: number;
  totalMemory: number;
  freeMemory: number;
};

// ============================================================================
// 알림/통지
// ============================================================================

/** 알림: 알림 표시 */
export interface NotificationShowArgs {
  title: string;
  body?: string;
  icon?: string;
  urgency?: 'low' | 'normal' | 'critical';
}
export type NotificationShowResponse = {
  notificationId: string;
};

/** 알림: 알림 숨기기 */
export interface NotificationHideArgs {
  notificationId: string;
}
export type NotificationHideResponse = boolean;

// ============================================================================
// 상태 동기화
// ============================================================================

/** 상태: 동기화 (Main → Renderer) */
export interface StateSyncArgs {
  key: string;
  value: SerializableRecord;
}
export type StateSyncResponse = never; // 단방향

/** 상태: 업데이트 (Renderer → Main) */
export interface StateUpdateArgs {
  key: string;
  value: SerializableRecord;
}
export type StateUpdateResponse = boolean;

// ============================================================================
// 전체 채널 맵 (타입 안전한 invoke 호출을 위한 맵핑)
// ============================================================================

/**
 * IPC 채널 전체 맵핑
 * 
 * 각 채널의 Args/Response 타입을 정의하여
 * 타입 안전한 invoke() 호출 가능
 * 
 * @example
 * ```typescript
 * // 타입 정의
 * interface IpcChannelMap {
 *   'browser:navigateTo': {
 *     args: BrowserNavigateToArgs;
 *     response: BrowserNavigateToResponse;
 *   };
 * }
 * 
 * // 사용
 * const response = await invoke<'browser:navigateTo'>(
 *   'browser:navigateTo',
 *   { url: 'https://example.com' }  // ← 타입 자동완성
 * );
 * // response 타입: BrowserNavigateToResponse
 * ```
 */
export interface IpcChannelMap {
  // 브라우저 네비게이션
  'browser:navigateTo': {
    args: BrowserNavigateToArgs;
    response: BrowserNavigateToResponse;
  };
  'browser:goBack': { args: BrowserGoBackArgs; response: BrowserGoBackResponse };
  'browser:goForward': {
    args: BrowserGoForwardArgs;
    response: BrowserGoForwardResponse;
  };
  'browser:reload': { args: BrowserReloadArgs; response: BrowserReloadResponse };
  'browser:reloadIgnoreCache': {
    args: BrowserReloadIgnoreCacheArgs;
    response: BrowserReloadIgnoreCacheResponse;
  };
  'browser:stop': { args: BrowserStopArgs; response: BrowserStopResponse };
  'browser:zoomIn': { args: BrowserZoomInArgs; response: BrowserZoomInResponse };
  'browser:zoomOut': {
    args: BrowserZoomOutArgs;
    response: BrowserZoomOutResponse;
  };
  'browser:zoomReset': {
    args: BrowserZoomResetArgs;
    response: BrowserZoomResetResponse;
  };
  'browser:findInPage': {
    args: BrowserFindInPageArgs;
    response: BrowserFindInPageResponse;
  };
  'browser:print': { args: BrowserPrintArgs; response: BrowserPrintResponse };
  'browser:devTools': {
    args: BrowserDevToolsArgs;
    response: BrowserDevToolsResponse;
  };

  // 탭 관리
  'tab:createNew': { args: TabCreateNewArgs; response: TabCreateNewResponse };
  'tab:close': { args: TabCloseArgs; response: TabCloseResponse };
  'tab:select': { args: TabSelectArgs; response: TabSelectResponse };
  'tab:update': { args: TabUpdateArgs; response: TabUpdateResponse };
  'tab:getAll': { args: TabGetAllArgs; response: TabGetAllResponse };
  'tab:duplicate': { args: TabDuplicateArgs; response: TabDuplicateResponse };
  'tab:mute': { args: TabMuteArgs; response: TabMuteResponse };
  'tab:pin': { args: TabPinArgs; response: TabPinResponse };

  // 히스토리 관리
  'history:add': { args: HistoryAddArgs; response: HistoryAddResponse };
  'history:getAll': { args: HistoryGetAllArgs; response: HistoryGetAllResponse };
  'history:search': { args: HistorySearchArgs; response: HistorySearchResponse };
  'history:delete': { args: HistoryDeleteArgs; response: HistoryDeleteResponse };
  'history:clear': { args: HistoryClearArgs; response: HistoryClearResponse };

  // 북마크 관리
  'bookmark:add': { args: BookmarkAddArgs; response: BookmarkAddResponse };
  'bookmark:remove': {
    args: BookmarkRemoveArgs;
    response: BookmarkRemoveResponse;
  };
  'bookmark:getAll': {
    args: BookmarkGetAllArgs;
    response: BookmarkGetAllResponse;
  };
  'bookmark:search': {
    args: BookmarkSearchArgs;
    response: BookmarkSearchResponse;
  };
  'bookmark:createFolder': {
    args: BookmarkCreateFolderArgs;
    response: BookmarkCreateFolderResponse;
  };
  'bookmark:updateFolder': {
    args: BookmarkUpdateFolderArgs;
    response: BookmarkUpdateFolderResponse;
  };

  // 설정 관리
  'settings:get': { args: SettingsGetArgs; response: SettingsGetResponse };
  'settings:getAll': {
    args: SettingsGetAllArgs;
    response: SettingsGetAllResponse;
  };
  'settings:set': { args: SettingsSetArgs; response: SettingsSetResponse };
  'settings:reset': {
    args: SettingsResetArgs;
    response: SettingsResetResponse;
  };
  'settings:getTheme': {
    args: SettingsGetThemeArgs;
    response: SettingsGetThemeResponse;
  };
  'settings:setTheme': {
    args: SettingsSetThemeArgs;
    response: SettingsSetThemeResponse;
  };

  // 파일 작업
  'file:open': { args: FileOpenArgs; response: FileOpenResponse };
  'file:save': { args: FileSaveArgs; response: FileSaveResponse };
  'file:download': { args: FileDownloadArgs; response: FileDownloadResponse };
  'file:openDialog': {
    args: FileOpenDialogArgs;
    response: FileOpenDialogResponse;
  };
  'file:saveDialog': {
    args: FileSaveDialogArgs;
    response: FileSaveDialogResponse;
  };

  // 윈도우 제어
  'window:minimize': {
    args: WindowMinimizeArgs;
    response: WindowMinimizeResponse;
  };
  'window:maximize': {
    args: WindowMaximizeArgs;
    response: WindowMaximizeResponse;
  };
  'window:restore': {
    args: WindowRestoreArgs;
    response: WindowRestoreResponse;
  };
  'window:close': { args: WindowCloseArgs; response: WindowCloseResponse };
  'window:toggleFullscreen': {
    args: WindowToggleFullscreenArgs;
    response: WindowToggleFullscreenResponse;
  };
  'window:toggleDevTools': {
    args: WindowToggleDevToolsArgs;
    response: WindowToggleDevToolsResponse;
  };

  // 앱 제어
  'app:exit': { args: AppExitArgs; response: AppExitResponse };
  'app:getVersion': {
    args: AppGetVersionArgs;
    response: AppGetVersionResponse;
  };
  'app:checkUpdate': {
    args: AppCheckUpdateArgs;
    response: AppCheckUpdateResponse;
  };
  'app:restart': { args: AppRestartArgs; response: AppRestartResponse };
  'app:getSystemInfo': {
    args: AppGetSystemInfoArgs;
    response: AppGetSystemInfoResponse;
  };

  // 알림/통지
  'notification:show': {
    args: NotificationShowArgs;
    response: NotificationShowResponse;
  };
  'notification:hide': {
    args: NotificationHideArgs;
    response: NotificationHideResponse;
  };

  // 상태 동기화
  'state:sync': { args: StateSyncArgs; response: StateSyncResponse };
  'state:update': { args: StateUpdateArgs; response: StateUpdateResponse };
}

/**
 * 타입 안전한 channel 타입
 * 모든 유효한 IPC 채널명의 Union
 */
export type TypedIpcChannel = keyof IpcChannelMap;
