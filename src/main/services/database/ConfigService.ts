/**
 * Config Service
 * 
 * Electron Store를 사용한 앱 설정 관리
 * - 테마, 언어, 줌, 창 상태 등
 * - 스키마 검증
 * - 자동 마이그레이션
 * 
 * Prisma와의 역할 분리:
 * - ConfigService (electron-store): 앱 설정 + 윈도우 상태 (JSON)
 * - DatabaseService (Prisma): 사용자 데이터 (tabs, history, bookmarks)
 */

/**
 * 저장할 설정 타입
 */
export interface AppConfig {
  // 테마 설정
  theme: 'light' | 'dark' | 'auto';
  
  // 표시 설정
  zoomLevel: number;
  language: string;
  
  // 시작 설정
  startPage: string;
  restorePreviousSession: boolean;
  
  // 기능 설정
  enableNotifications: boolean;
  enableCookies: boolean;
  cacheSize: number;
  
  // 윈도우 상태
  windowState: {
    width: number;
    height: number;
    x: number | undefined;
    y: number | undefined;
    isMaximized: boolean;
  };
  
  // 마지막 활성 탭
  lastActiveTabId: string | undefined;
}

/**
 * electron-store 스키마 정의
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const schema: any = {
  theme: {
    type: 'string',
    enum: ['light', 'dark', 'auto'],
    default: 'auto',
    description: '애플리케이션 테마'
  },
  zoomLevel: {
    type: 'number',
    minimum: 0.5,
    maximum: 3.0,
    default: 1.0,
    description: '줌 레벨 (0.5 ~ 3.0)'
  },
  language: {
    type: 'string',
    enum: ['en', 'ko', 'ja', 'zh'],
    default: 'en',
    description: '언어 설정'
  },
  startPage: {
    type: 'string',
    default: 'about:blank',
    description: '시작 페이지 URL'
  },
  restorePreviousSession: {
    type: 'boolean',
    default: true,
    description: '이전 세션 복원'
  },
  enableNotifications: {
    type: 'boolean',
    default: true,
    description: '알림 활성화'
  },
  enableCookies: {
    type: 'boolean',
    default: true,
    description: '쿠키 활성화'
  },
  cacheSize: {
    type: 'number',
    minimum: 100,
    maximum: 5000,
    default: 500,
    description: '캐시 크기 (MB)'
  },
  windowState: {
    type: 'object',
    properties: {
      width: { type: 'number', default: 1280 },
      height: { type: 'number', default: 800 },
      x: { type: ['number', 'null'], default: undefined },
      y: { type: ['number', 'null'], default: undefined },
      isMaximized: { type: 'boolean', default: false }
    },
    default: {
      width: 1280,
      height: 800,
      x: undefined,
      y: undefined,
      isMaximized: false
    }
  },
  lastActiveTabId: {
    type: ['string', 'null'],
    default: undefined
  }
};

/**
 * Config Service 싱글톤
 * 
 * electron-store로 설정 관리
 * ~/.config/aside/config.json (Linux/macOS) 또는 %APPDATA%\aside\config.json (Windows)
 */
export class ConfigService {
  private static instance: ConfigService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private store: any;

  private constructor() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const ElectronStore = require('electron-store');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.store = new ElectronStore({
      name: 'config',
      schema,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrations: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        '1.0.0': (store: any) => {
          // 버전 1.0.0 마이그레이션 (필요시 추가)
          if (!store.has('cacheSize')) {
            store.set('cacheSize', 500);
          }
        }
      }
    });
  }

  /**
   * ConfigService 인스턴스 획득
   */
  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * 모든 설정 조회
   */
  getAll(): AppConfig {
    return this.store.store;
  }

  /**
   * 설정 조회
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.store.get(key);
  }

  /**
   * 설정 저장
   */
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.store.set(key, value);
  }

  /**
   * 여러 설정 저장
   */
  setMultiple(updates: Partial<AppConfig>): void {
    Object.entries(updates).forEach(([key, value]) => {
      this.store.set(key, value);
    });
  }

  /**
   * 설정 삭제 (기본값으로 리셋)
   */
  reset<K extends keyof AppConfig>(key: K): void {
    this.store.delete(key);
  }

  /**
   * 모든 설정 초기화
   */
  resetAll(): void {
    this.store.clear();
  }

  /**
   * 저장소 경로 (디버깅용)
   */
  getStorePath(): string {
    return this.store.path;
  }

  /**
   * 창 상태 저장
   */
  saveWindowState(state: AppConfig['windowState']): void {
    this.set('windowState', state);
  }

  /**
   * 창 상태 조회
   */
  getWindowState(): AppConfig['windowState'] {
    return this.get('windowState');
  }

  /**
   * 테마 설정 조회/저장
   */
  getTheme(): AppConfig['theme'] {
    return this.get('theme');
  }

  setTheme(theme: AppConfig['theme']): void {
    this.set('theme', theme);
  }

  /**
   * 언어 설정 조회/저장
   */
  getLanguage(): string {
    return this.get('language');
  }

  setLanguage(language: string): void {
    this.set('language', language);
  }

  /**
   * 줌 레벨 조회/저장
   */
  getZoomLevel(): number {
    return this.get('zoomLevel');
  }

  setZoomLevel(zoomLevel: number): void {
    this.set('zoomLevel', Math.max(0.5, Math.min(3.0, zoomLevel)));
  }

  /**
   * 마지막 활성 탭 ID
   */
  getLastActiveTabId(): string | undefined {
    return this.get('lastActiveTabId');
  }

  setLastActiveTabId(tabId: string | undefined): void {
    this.set('lastActiveTabId', tabId);
  }
}

export default ConfigService;
