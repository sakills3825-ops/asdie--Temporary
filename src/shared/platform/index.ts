/**
 * Platform index export
 *
 * Main/Renderer에서 다음과 같이 사용:
 * - import { getPlatform, getZenDataDir, normalizePath } from '@shared/platform'
 * - import { getSystemInfo, getPerformanceConfig } from '@shared/platform'
 * - import type { PlatformInfo, SystemInfo } from '@shared/platform'
 */

export {
  getPlatform,
  getHomeDir,
  getTempDir,
  getZenDataDir,
  getZenLogsDir,
  getZenCacheDir,
  normalizePath,
  isAbsolutePath,
  getRelativePath,
  parsePath,
  joinPaths,
  normalizeLineEndings,
  getEnvVariable,
  isValidFilename,
  getPathSeparator,
  getPlatformInfo,
} from './paths';
export type { Platform, PlatformInfo } from './paths';

export {
  getSystemInfo,
  getPerformanceConfig,
  getUIConfig,
  getDisplayScaleFactor,
  getFeatureSupport,
  getEnvironmentSettings,
} from './environment';
export type {
  SystemInfo,
  PerformanceConfig,
  UIConfig,
  FeatureSupport,
  EnvironmentSettings,
} from './environment';

export {
  getPlatformSafe,
  getArchSafe,
  getWindowsAppDataPath,
  getMacOSAppSupportPath,
  getLinuxDataPath,
  getAppDataDir,
  getLogsDir,
  getCacheDir,
  createTempDirSafe,
  removeDirSafe,
} from './environment-safety';
export type { Platform as PlatformType, Arch } from './environment-safety';

export {
  isPathTraversal,
  isPathInBounds,
  joinSafePath,
  getRealPath,
  isSymlink,
  safeReadFile,
  getFilePermissions,
  getFileOwner,
  isPermissionTooPermissive,
  validateConfigFilePermissions,
  safeEnsureDirectory,
  safeWriteFile,
  SafePath,
} from './path-safety';
