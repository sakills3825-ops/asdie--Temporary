/**
 * Main Process Entry Point
 *
 * Electron 앱의 메인 프로세스 진입점
 * - 모든 core 모듈 초기화
 * - 모든 managers 초기화
 * - 모든 services 초기화
 * - 모든 handlers 초기화 및 IPC 등록
 * - 앱 전역 설정 및 에러 핸들링
 *
 * 실행 순서:
 * 1. Logger 설정
 * 2. ConfigManager 초기화
 * 3. WindowManager 생성
 * 4. AppLifecycle 생성 및 초기화
 * 5. Managers 인스턴스 생성 (TabManager, HistoryManager, ResourceManager)
 * 6. Services 인스턴스 생성 (의존성 주입)
 * 7. IPC Handlers 등록
 * 8. 전역 에러 핸들러 설정
 * 9. EventBus로 이벤트 통신 시작
 */

import { LoggerImpl, LogLevel } from '../shared/logger';
import { AppLifecycle } from './core/appLifecycle';
import { WindowManager } from './core/window';
import { EventBus } from './core/EventBus';
import { ConfigManager } from './managers/ConfigManager';
import { TabManager } from './managers/TabManager';
import { HistoryManager } from './managers/HistoryManager';
import { ResourceManager } from './managers/ResourceManager';
import { DatabaseService } from './services/database/DatabaseService';
import { initializeAllServices } from './services';
import { registerAllHandlers } from './handlers';

const logger = new LoggerImpl('Main', LogLevel.DEBUG);

/**
 * 전체 애플리케이션 상태 관리
 */
interface AppState {
  configManager: ConfigManager;
  windowManager: WindowManager;
  appLifecycle: AppLifecycle;
  databaseService: DatabaseService;
  tabManager: TabManager;
  historyManager: HistoryManager;
  resourceManager: ResourceManager;
}

/**
 * 의존성 초기화 헬퍼
 */
async function initializeDependencies(): Promise<AppState> {
  // 1. 설정 초기화
  logger.info('Main: Initializing config');
  const configManager = new ConfigManager();
  await configManager.initialize();
  const config = configManager.getAll();

  // 2. 데이터베이스 초기화 (Prisma + Repositories)
  logger.info('Main: Initializing DatabaseService');
  const databaseService = await DatabaseService.getInstance();

  // 3. 윈도우 매니저 생성
  logger.info('Main: Creating WindowManager');
  const windowManager = new WindowManager({
    width: config.window?.width ?? 1200,
    height: config.window?.height ?? 800,
    // buildInfo는 WindowManager 내부에서 자동 감지됨
  });

  // 4. 앱 생명주기 관리자 생성
  logger.info('Main: Creating AppLifecycle');
  const appLifecycle = new AppLifecycle(windowManager, {
    autoStartMinimized: false,
    restorePreviousSession: config.restorePreviousSession ?? true,
    allowMultipleInstances: false,
  });

  // 5. Managers 생성 (의존성 주입)
  logger.info('Main: Creating Managers');
  const tabManager = TabManager.create(databaseService.getTabRepository());
  const historyManager = HistoryManager.create(databaseService.getHistoryRepository());
  const resourceManager = new ResourceManager();

  return {
    configManager,
    windowManager,
    appLifecycle,
    databaseService,
    tabManager,
    historyManager,
    resourceManager,
  };
}

/**
 * 서비스 및 핸들러 초기화
 */
function initializeServicesAndHandlers(state: AppState): void {
  logger.info('Main: Initializing Services');
  const services = initializeAllServices(
    state.tabManager,
    state.historyManager,
    state.resourceManager,
    state.windowManager,
    state.databaseService
  );

  logger.info('Main: Registering IPC Handlers');
  registerAllHandlers(
    services.tabService,
    services.historyService,
    services.bookmarkService,
    services.windowService
  );
}

/**
 * 전역 에러 핸들러 설정
 */
function setupGlobalErrorHandlers(): void {
  logger.info('Main: Setting up global error handlers');

  // 처리되지 않은 예외 처리
  process.on('uncaughtException', (error) => {
    logger.error('Main: Uncaught Exception', error);
    // 프로덕션 환경에서는 앱 종료
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  // 처리되지 않은 Promise 거부 처리
  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('Main: Unhandled Rejection', error);
    // 프로덕션 환경에서는 앱 종료
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
}

/**
 * 애플리케이션 정리
 */
async function cleanup(state: AppState): Promise<void> {
  logger.info('Main: Cleaning up');

  try {
    // 설정 저장
    await state.configManager.save();

    // 모든 윈도우 닫기
    state.windowManager.closeAllWindows();

    // ResourceManager 중지 (모니터링 루프 정지)
    state.resourceManager.stopMonitoring();

    // 데이터베이스 연결 종료
    await state.databaseService.disconnect();

    logger.info('Main: Cleanup completed');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Main: Cleanup failed', err);
  }
}

/**
 * 애플리케이션 초기화
 */
async function appInitializationFlow(state: AppState): Promise<void> {
  // 1. 앱 생명주기 초기화
  logger.info('Main: Initializing AppLifecycle');
  await state.appLifecycle.initialize();

  // 2. 서비스 및 핸들러 초기화
  initializeServicesAndHandlers(state);

  // 3. 전역 에러 핸들러 설정
  setupGlobalErrorHandlers();

  // 4. EventBus 초기화
  const eventBus = EventBus.getInstance();
  eventBus.emit('app:initialized', { version: '1.0.0' });

  logger.info('Main: Application started successfully');
}

/**
 * 메인 실행 로직
 */
async function handleMainExecution(): Promise<void> {
  logger.info('Main: Starting application');
  const state = await initializeDependencies();
  await appInitializationFlow(state);
  setupExitHandlers(state);
}

/**
 * 프로세스 종료 핸들러 설정
 */
function setupExitHandlers(state: AppState): void {
  // 앱 종료 시 정리
  process.on('exit', async () => {
    logger.info('Main: Process exiting');
    await cleanup(state);
  });

  // Ctrl+C 처리
  process.on('SIGINT', async () => {
    logger.info('Main: SIGINT received');
    await cleanup(state);
    process.exit(0);
  });
}

// 앱 시작
handleMainExecution().catch((error: unknown) => {
  console.error('Uncaught error in main:', error);
  process.exit(1);
});

