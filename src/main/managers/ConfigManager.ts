/**
 * ConfigManager - 앱 설정 관리
 *
 * 책임: 사용자 설정 파일 로드, 저장, 캐싱
 * - JSON 기반 설정 파일 관리
 * - 기본값 설정 및 병합
 * - 동기/비동기 작업 모두 지원
 * - 설정 변경 감지
 *
 * 파일 경로:
 * - macOS/Linux: ~/.config/aside/config.json
 * - Windows: %APPDATA%\Aside\config.json
 *
 * SRP 원칙: 오직 설정 파일 관리만 담당
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';
import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';

export interface AppConfig {
  // 브라우저 설정
  theme: 'light' | 'dark' | 'auto';
  zoomLevel: number;
  language: string;

  // 시작 페이지
  startPage?: string;
  restorePreviousSession: boolean;

  // 개인정보 설정
  enableNotifications: boolean;
  enableCookies: boolean;
  cacheSize?: number;

  // 윈도우 상태
  window?: {
    width: number;
    height: number;
    x: number;
    y: number;
    isMaximized: boolean;
  };
}

/**
 * 기본 설정값
 */
const DEFAULT_CONFIG: AppConfig = {
  theme: 'auto',
  zoomLevel: 1.0,
  language: 'en',
  startPage: 'about:blank',
  restorePreviousSession: true,
  enableNotifications: true,
  enableCookies: true,
  cacheSize: 500, // MB
};

/**
 * 앱 설정 관리자
 */
export class ConfigManager {
  private logger: ILogger;
  private configPath: string;
  private config: AppConfig = { ...DEFAULT_CONFIG };
  private isDirty = false;
  private writeTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.logger = new LoggerImpl('ConfigManager', LogLevel.INFO);
    this.configPath = this.getConfigPath();
  }

  /**
   * 설정 초기화
   * - 파일이 있으면 로드
   * - 없으면 기본값으로 생성
   *
   * @async
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('ConfigManager: Initializing');

      // 설정 디렉토리 생성
      const configDir = path.dirname(this.configPath);
      await this.createDirectory(configDir);

      // 파일이 있으면 로드
      try {
        await fs.access(this.configPath);
        await this.loadFromFile();
      } catch {
        // 파일이 없으면 기본값으로 저장
        await this.saveToFile();
      }

      this.isDirty = false;
      this.logger.info('ConfigManager: Initialized');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('ConfigManager: Initialization failed', err);
      throw error;
    }
  }

  /**
   * 설정값 조회
   *
   * @param key 설정 키 (점 표기법 지원: 'window.width')
   * @param defaultValue 기본값 (키가 없을 때)
   * @returns 설정값 또는 기본값
   *
   * @example
   * const theme = config.get<string>('theme', 'light');
   * const windowWidth = config.get<number>('window.width', 1200);
   */
  public get<T = any>(key: string, defaultValue?: T): T {
    const value = this.getNestedValue(this.config, key);
    return value !== undefined ? value : (defaultValue as T);
  }

  /**
   * 설정값 설정
   *
   * @param key 설정 키 (점 표기법 지원)
   * @param value 설정값
   *
   * @example
   * config.set('theme', 'dark');
   * config.set('window.width', 1920);
   */
  public set<T = any>(key: string, value: T): void {
    this.setNestedValue(this.config, key, value);
    this.isDirty = true;
    this.scheduleWrite();

    this.logger.debug('ConfigManager: Value set', {
      module: 'ConfigManager',
      metadata: { key, value },
    });
  }

  /**
   * 여러 설정값 한번에 설정
   *
   * @param updates 업데이트할 설정 객체
   *
   * @example
   * config.setMultiple({
   *   theme: 'dark',
   *   zoomLevel: 1.2,
   *   'window.width': 1920
   * });
   */
  public setMultiple(updates: Record<string, any>): void {
    for (const [key, value] of Object.entries(updates)) {
      this.set(key, value);
    }
  }

  /**
   * 설정 초기화 (기본값으로 복구)
   *
   * @async
   */
  public async reset(): Promise<void> {
    try {
      this.config = { ...DEFAULT_CONFIG };
      this.isDirty = true;
      await this.saveToFile();
      this.logger.info('ConfigManager: Config reset to default');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('ConfigManager: Failed to reset config', err);
      throw error;
    }
  }

  /**
   * 설정 저장 (파일에 쓰기)
   * 저장 요청이 여러 번 들어오면 마지막 요청만 처리 (디바운싱)
   *
   * @async
   */
  public async save(): Promise<void> {
    if (!this.isDirty) {
      return;
    }

    try {
      await this.saveToFile();
      this.isDirty = false;
      this.logger.debug('ConfigManager: Config saved to file');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('ConfigManager: Failed to save config', err);
      throw error;
    }
  }

  /**
   * 전체 설정 객체 조회
   *
   * @returns 현재 설정 복사본
   */
  public getAll(): AppConfig {
    return { ...this.config };
  }

  /**
   * 전체 설정 바꾸기
   *
   * @param config 새로운 설정 객체
   */
  public replaceAll(config: Partial<AppConfig>): void {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.isDirty = true;
    this.scheduleWrite();

    this.logger.info('ConfigManager: Entire config replaced');
  }

  /**
   * 설정 여부 확인
   *
   * @param key 설정 키
   * @returns 설정이 있으면 true
   */
  public has(key: string): boolean {
    return this.getNestedValue(this.config, key) !== undefined;
  }

  /**
   * 설정 삭제
   *
   * @param key 설정 키
   */
  public delete(key: string): void {
    this.deleteNestedValue(this.config, key);
    this.isDirty = true;
    this.scheduleWrite();

    this.logger.debug('ConfigManager: Value deleted', {
      module: 'ConfigManager',
      metadata: { key },
    });
  }

  // ============= Private Methods =============

  /**
   * 설정 파일 경로 조회
   *
   * @private
   */
  private getConfigPath(): string {
    let configDir: string;

    if (process.platform === 'darwin') {
      // macOS: ~/Library/Application Support/
      configDir = path.join(app.getPath('appData'), 'Aside');
    } else if (process.platform === 'win32') {
      // Windows: %APPDATA%\
      configDir = path.join(app.getPath('appData'), 'Aside');
    } else {
      // Linux: ~/.config/
      configDir = path.join(os.homedir(), '.config', 'aside');
    }

    return path.join(configDir, 'config.json');
  }

  /**
   * 파일에서 설정 로드
   *
   * @private
   */
  private async loadFromFile(): Promise<void> {
    try {
      const fileContent = await fs.readFile(this.configPath, 'utf-8');
      const fileConfig = JSON.parse(fileContent);

      // 기본값과 병합
      this.config = { ...DEFAULT_CONFIG, ...fileConfig };

      this.logger.info('ConfigManager: Loaded from file', {
        module: 'ConfigManager',
        metadata: { path: this.configPath },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('ConfigManager: Failed to load config from file', err);
      // 로드 실패 시 기본값 사용
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  /**
   * 파일에 설정 저장
   *
   * @private
   */
  private async saveToFile(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      await this.createDirectory(configDir);

      const json = JSON.stringify(this.config, null, 2);
      await fs.writeFile(this.configPath, json, 'utf-8');

      this.logger.debug('ConfigManager: Saved to file', {
        module: 'ConfigManager',
        metadata: { path: this.configPath },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('ConfigManager: Failed to save config to file', err);
      throw error;
    }
  }

  /**
   * 디렉토리 생성 (재귀)
   *
   * @private
   */
  private async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // 이미 존재하면 무시
      if ((error as any)?.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * 디바운싱된 쓰기 스케줄
   * 짧은 시간 내에 여러 번 호출되면 마지막 호출만 실행
   *
   * @private
   */
  private scheduleWrite(): void {
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
    }

    this.writeTimeout = setTimeout(async () => {
      await this.save();
    }, 1000); // 1초 대기
  }

  /**
   * 중첩 객체에서 값 조회 (점 표기법 지원)
   *
   * @private
   * @example
   * getNestedValue({ a: { b: { c: 1 } } }, 'a.b.c') // returns 1
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * 중첩 객체에 값 설정 (점 표기법 지원)
   *
   * @private
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (key && (!(key in current) || typeof current[key] !== 'object')) {
        current[key] = {};
      }
      if (key) {
        current = current[key];
      }
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }
  }

  /**
   * 중첩 객체에서 값 삭제 (점 표기법 지원)
   *
   * @private
   */
  private deleteNestedValue(obj: any, path: string): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!key || !(key in current)) {
        return;
      }
      current = current[key];
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      delete current[lastKey];
    }
  }
}
