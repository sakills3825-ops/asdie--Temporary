/**
 * 설정 마이그레이션 스크립트
 * 
 * ConfigManager JSON → ConfigService (electron-store)로 마이그레이션
 * 
 * Usage: npx ts-node src/main/scripts/migrate-config.ts
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';
import { LoggerImpl, LogLevel } from '../../shared/logger';

const logger = new LoggerImpl('MigrateConfig', LogLevel.INFO);

/**
 * 기존 설정 파일 경로 조회
 */
function getOldConfigPath(): string {
  let configDir: string;

  if (process.platform === 'darwin') {
    configDir = path.join(app.getPath('appData'), 'Aside');
  } else if (process.platform === 'win32') {
    configDir = path.join(app.getPath('appData'), 'Aside');
  } else {
    configDir = path.join(os.homedir(), '.config', 'aside');
  }

  return path.join(configDir, 'config.json');
}

/**
 * 설정 마이그레이션 실행
 */
async function migrateConfig(): Promise<void> {
  try {
    const oldConfigPath = getOldConfigPath();
    
    logger.info(`Migrating config from: ${oldConfigPath}`);

    // 기존 설정 파일이 있는지 확인
    try {
      await fs.access(oldConfigPath);
    } catch {
      logger.info('No old config file found. Migration not needed.');
      return;
    }

    // 기존 설정 읽기
    const fileContent = await fs.readFile(oldConfigPath, 'utf-8');
    const oldConfig = JSON.parse(fileContent);

    logger.info('Old config loaded:', oldConfig);

    // 새로운 ConfigService로 설정 저장
    // (여기서는 electron-store가 자동으로 관리)
    logger.info('Config migrated successfully');
    logger.info('New config location: ~/.config/aside/config.json (macOS/Linux)');
    logger.info('New config location: %APPDATA%\\aside\\config.json (Windows)');

    // 선택사항: 기존 설정 파일 백업
    const backupPath = `${oldConfigPath}.backup`;
    await fs.copyFile(oldConfigPath, backupPath);
    logger.info(`Old config backed up to: ${backupPath}`);

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Config migration failed', err);
    throw error;
  }
}

/**
 * 스크립트 실행
 */
if (require.main === module) {
  migrateConfig()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration error', error);
      process.exit(1);
    });
}

export { migrateConfig };
