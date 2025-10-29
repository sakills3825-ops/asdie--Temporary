/**
 * 도메인 타입 정의
 *
 * BrowserTab, Bookmark, HistoryEntry 등 앱의 핵심 도메인 타입들.
 * IPC 통신과 무관하게 데이터 모델을 나타냄.
 */

/**
 * 브라우저 탭 정보
 * 
 * Prisma BrowserTab 모델과 일치
 */
export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  favicon?: string | null;
  isActive: boolean;
  isMuted: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 히스토리 항목
 * 
 * Prisma History 모델과 일치
 * id와 title은 선택사항 (저장 시 서버에서 생성 가능)
 */
export interface HistoryEntry {
  id?: string;
  url: string;
  title?: string;
  favicon?: string | null;
  visitedAt: Date;
  duration: number; // 방문 지속 시간 (ms)
  visits?: number;
}

/**
 * 북마크
 * 
 * Prisma Bookmark 모델과 일치
 */
export interface Bookmark {
  id: string;
  url: string;
  title: string;
  folder?: string;
  description?: string | null;
  favicon?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 자주 방문한 사이트
 */
export interface FrequentSite {
  url: string;
  count: number;
}

/**
 * 앱 설정
 */
export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  zoomLevel: number;
  language: string;
  startPage?: string;
  enableNotifications: boolean;
  enableCookies: boolean;
  cacheSize?: number;
}

/**
 * 파일 다이얼로그 옵션
 */
export interface FileDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
  properties?: string[];
}

/**
 * 앱 정보
 */
export interface AppInfo {
  name: string;
  version: string;
  description: string;
  buildDate: string;
  isDevMode: boolean;
}
