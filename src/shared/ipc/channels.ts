/**
 * IPC 채널 정의 (직관적 네이밍)
 *
 * rules : 직관적인 채널명
 * 형식: {기능도메인}:{세부기능}
 *
 * 예시:
 * - 'browserNavigateTo' → "브라우저 특정 URL로 이동"
 * - 'tabCreateNew' → "새 탭 생성"
 * - 'historyGetAll' → "히스토리 전체 조회"
 */

export const IPC_CHANNELS = {
  // ===== 브라우저 네비게이션 (Browser Navigation) =====
  // "브라우저가 하는" 일들: 주소입력, 뒤로가기, 새로고침 등
  browserNavigateTo: 'browser:navigateTo', // URL로 이동
  browserGoBack: 'browser:goBack', // 뒤로 가기
  browserGoForward: 'browser:goForward', // 앞으로 가기
  browserReload: 'browser:reload', // 새로고침 (일반)
  browserReloadIgnoreCache: 'browser:reloadIgnoreCache', // 새로고침 (캐시무시)
  browserStop: 'browser:stop', // 페이지 로드 중지
  browserZoomIn: 'browser:zoomIn', // 확대
  browserZoomOut: 'browser:zoomOut', // 축소
  browserZoomReset: 'browser:zoomReset', // 기본 줌 레벨
  browserFindInPage: 'browser:findInPage', // 페이지 내 검색
  browserPrint: 'browser:print', // 인쇄
  browserDevTools: 'browser:devTools', // 개발자도구 열기

  // ===== 탭 관리 (Tab Management) =====
  // "탭"에 대한 작업들: 생성, 삭제, 전환, 업데이트
  tabCreateNew: 'tab:createNew', // 새 탭 생성
  tabClose: 'tab:close', // 탭 닫기
  tabSelect: 'tab:select', // 탭 선택/전환
  tabUpdate: 'tab:update', // 탭 정보 업데이트 (URL, 제목 등)
  tabGetAll: 'tab:getAll', // 모든 탭 조회
  tabDuplicate: 'tab:duplicate', // 탭 복제
  tabMute: 'tab:mute', // 탭 음소거
  tabPin: 'tab:pin', // 탭 고정

  // ===== 히스토리 관리 (History Management) =====
  // "방문 기록"에 대한 작업들: 추가, 조회, 삭제, 초기화
  historyAdd: 'history:add', // 히스토리 항목 추가
  historyGetAll: 'history:getAll', // 모든 히스토리 조회
  historySearch: 'history:search', // 히스토리 검색
  historyDelete: 'history:delete', // 특정 히스토리 삭제
  historyClear: 'history:clear', // 모든 히스토리 삭제

  // ===== 북마크 관리 (Bookmark Management) =====
  // "북마크"에 대한 작업들: 추가, 삭제, 조회, 폴더
  bookmarkAdd: 'bookmark:add', // 북마크 추가
  bookmarkRemove: 'bookmark:remove', // 북마크 삭제
  bookmarkGetAll: 'bookmark:getAll', // 모든 북마크 조회
  bookmarkSearch: 'bookmark:search', // 북마크 검색
  bookmarkCreateFolder: 'bookmark:createFolder', // 북마크 폴더 생성
  bookmarkUpdateFolder: 'bookmark:updateFolder', // 북마크 폴더 이름 변경

  // ===== 설정 관리 (Settings Management) =====
  // "설정값"에 대한 작업들: 조회, 저장, 초기화
  settingsGet: 'settings:get', // 특정 설정값 조회
  settingsGetAll: 'settings:getAll', // 모든 설정값 조회
  settingsSet: 'settings:set', // 설정값 저장
  settingsReset: 'settings:reset', // 설정 초기화
  settingsGetTheme: 'settings:getTheme', // 테마 조회
  settingsSetTheme: 'settings:setTheme', // 테마 설정

  // ===== 파일 작업 (File Operations) =====
  // "파일"에 대한 작업들: 열기, 저장, 다운로드
  fileOpen: 'file:open', // 파일 열기
  fileSave: 'file:save', // 파일 저장
  fileDownload: 'file:download', // 파일 다운로드
  fileOpenDialog: 'file:openDialog', // 파일 선택 대화상자
  fileSaveDialog: 'file:saveDialog', // 파일 저장 대화상자

  // ===== 윈도우 제어 (Window Control) =====
  // "윈도우"에 대한 작업들: 최소화, 최대화, 닫기
  windowMinimize: 'window:minimize', // 최소화
  windowMaximize: 'window:maximize', // 최대화
  windowRestore: 'window:restore', // 복원
  windowClose: 'window:close', // 윈도우 닫기
  windowToggleFullscreen: 'window:toggleFullscreen', // 전체화면 토글
  windowToggleDevTools: 'window:toggleDevTools', // 개발자 도구 토글

  // ===== 앱 제어 (App Control) =====
  // "애플리케이션" 자체에 대한 작업들: 종료, 버전 확인, 업데이트
  appExit: 'app:exit', // 앱 종료
  appGetVersion: 'app:getVersion', // 버전 정보 조회
  appCheckUpdate: 'app:checkUpdate', // 업데이트 확인
  appRestart: 'app:restart', // 앱 재시작
  appGetSystemInfo: 'app:getSystemInfo', // 시스템 정보 조회

  // ===== 알림/통지 (Notifications) =====
  // "알림"에 대한 작업들: 표시, 제거
  notificationShow: 'notification:show', // 알림 표시
  notificationHide: 'notification:hide', // 알림 숨기기

  // ===== 상태 동기화 (State Sync) =====
  // Main ↔ Renderer 상태 동기화
  stateSync: 'state:sync', // 상태 동기화 (Main → Renderer)
  stateUpdate: 'state:update', // 상태 업데이트 (Renderer → Main)
} as const;

/**
 * IPC 채널 타입 (모든 채널명의 Union)
 */
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
