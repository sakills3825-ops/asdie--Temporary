# 📚 코드 예시 및 패턴 가이드

## 1️⃣ Shared 레이어 사용 예시

### 에러 처리

```typescript
// ✅ Shared에서 에러 정의
import { BaseError, ValidationError, ERROR_CODES } from '@shared';

throw new ValidationError('Email is invalid', {
  field: 'email',
  value: userInput
});

// ✅ BaseError 상속받은 커스텀 에러
export class DatabaseError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ERROR_CODES.DATABASE_ERROR, 500, context);
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}
```

### IPC 통신 (Renderer → Main)

```typescript
// ✅ Renderer에서 요청
import { window.electronAPI } from '@preload';

async function createNewTab() {
  const response = await window.electronAPI.invoke('tab:createNew', {
    url: 'https://example.com',
    title: 'Example'
  });

  if (response.success) {
    console.log('Tab created:', response.data);
  } else {
    console.error('Error:', response.error, response.code);
  }
}

// ✅ Main에서 응답
import { IpcResponseHelper } from '@shared';

return IpcResponseHelper.success({
  id: 'tab-123',
  url: 'https://example.com',
  title: 'Example'
});
```

### 로깅

```typescript
import { LoggerImpl, LogLevel } from '@shared';

const logger = new LoggerImpl('MyModule', LogLevel.DEBUG);

logger.info('User action', {
  userId: '123',
  action: 'create_tab',
  url: 'https://example.com'
});

logger.error('Operation failed', error, {
  context: 'tab_creation',
  userId: '123'
});
```

---

## 2️⃣ Main Process 계층별 패턴

### Manager 패턴

```typescript
// ✅ 상태 저장소만 담당
class TabManager {
  private tabs: Map<string, BrowserTab> = new Map();

  public addTab(url: string, title: string): BrowserTab {
    const id = this.generateId();
    const tab: BrowserTab = { id, url, title, ... };
    this.tabs.set(id, tab);
    return tab;
  }

  public getTab(id: string): BrowserTab | undefined {
    return this.tabs.get(id);
  }

  public getAllTabs(): BrowserTab[] {
    return Array.from(this.tabs.values());
  }

  private generateId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Service 패턴

```typescript
// ✅ 비즈니스 로직 (검증, 제약 처리)
class TabService {
  private readonly MAX_TABS = 100;
  private readonly TAB_MEMORY_LIMIT = 500; // MB

  constructor(
    private tabManager: TabManager,
    private resourceManager: ResourceManager
  ) {}

  async createTab(url: string, title: string): Promise<BrowserTab> {
    // 검증
    if (!this.isValidUrl(url)) {
      throw new ValidationError('Invalid URL');
    }

    // 제약 확인
    const allTabs = this.tabManager.getAllTabs();
    if (allTabs.length >= this.MAX_TABS) {
      throw new Error(`Maximum ${this.MAX_TABS} tabs reached`);
    }

    // 리소스 확인
    if (!this.resourceManager.canAllocate(40)) {
      throw new Error('Insufficient memory');
    }

    // 비즈니스 로직 실행
    const tab = this.tabManager.addTab(url, title);
    
    // 이벤트 발행
    EventBus.getInstance().emit('tab:created', tab);

    return tab;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
```

### Handler 패턴

```typescript
// ✅ IPC 라우터 (요청 처리 및 응답)
class TabHandler {
  constructor(private tabService: ITabService) {}

  registerHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.tabCreateNew, 
      (_event, args: { url: string; title?: string }) => 
        this.handleCreateTab(args)
    );
  }

  private async handleCreateTab(
    args: { url: string; title?: string }
  ): Promise<IpcResponse> {
    try {
      const tab = await this.tabService.createTab(
        args.url,
        args.title || 'New Tab'
      );
      return IpcResponseHelper.success(tab);
    } catch (error) {
      return handleIpcError(error);
    }
  }
}
```

---

## 3️⃣ 아키텍처 패턴

### Layered Architecture

```
┌──────────────────────────┐
│   Renderer (UI Layer)    │  React 컴포넌트
└────────────┬─────────────┘
             │ IPC
┌────────────▼─────────────┐
│  Handlers (Router)       │  요청 라우팅
├──────────────────────────┤
│  Services (Business)     │  비즈니스 로직
├──────────────────────────┤
│  Managers (State Store)  │  상태 저장
├──────────────────────────┤
│  Core (System Mgmt)      │  앱 생명주기
└──────────────────────────┘
         │
┌────────▼──────────┐
│  Shared (Common)  │  공유 자원
└───────────────────┘
```

### 의존성 흐름

```
Handler
  ↑ (서비스 주입)
  │
Service
  ↑ (매니저 주입)
  │
Manager
  ↑ (상태 관리)
  │
Core (시스템 초기화 후 모두 설정됨)
```

---

## 4️⃣ 에러 처리 패턴

### 완전한 에러 흐름

```typescript
// ❌ Bad: 에러 무시
try {
  const result = await operation();
} catch (error) {
  // 에러 무시
}

// ✅ Good: 적절한 에러 처리
try {
  const result = await operation();
  return IpcResponseHelper.success(result);
} catch (error) {
  if (error instanceof ValidationError) {
    return IpcResponseHelper.error(error.message, error.code);
  }
  
  if (error instanceof Error) {
    logger.error('Operation failed', error);
    return IpcResponseHelper.error(
      'Operation failed',
      ERROR_CODES.UNKNOWN
    );
  }
  
  return IpcResponseHelper.error('Unknown error', ERROR_CODES.UNKNOWN);
}
```

### Custom Error

```typescript
// Shared에서 정의
export class PermissionError extends BaseError {
  constructor(resource: string, action: string) {
    super(
      `Permission denied: ${action} on ${resource}`,
      ERROR_CODES.PERMISSION_DENIED,
      403,
      { resource, action }
    );
    Object.setPrototypeOf(this, PermissionError.prototype);
  }
}

// Main에서 사용
if (!hasPermission(user, resource)) {
  throw new PermissionError(resource, 'read');
}
```

---

## 5️⃣ 타입 안전성 패턴

### IPC 채널 타입 오버로드

```typescript
// ✅ 타입 안전한 IPC 호출
interface IpcChannelMap {
  'tab:createNew': {
    args: { url: string; title?: string };
    response: { id: string; url: string; title: string };
  };
  'history:search': {
    args: { query: string; limit?: number };
    response: Array<{ id: string; url: string; title: string }>;
  };
}

// 타입 안전한 invoke
async function invoke<T extends keyof IpcChannelMap>(
  channel: T,
  args: IpcChannelMap[T]['args']
): Promise<IpcChannelMap[T]['response']> {
  const response = await ipcRenderer.invoke(channel, args);
  return response.data;
}

// 사용
const tab = await invoke('tab:createNew', { url: 'https://...' });
// tab의 타입은 자동으로 { id, url, title }
```

### Generic Service

```typescript
abstract class BaseService<T> {
  protected logger: ILogger;

  constructor(protected manager: Manager<T>) {
    this.logger = new LoggerImpl(this.constructor.name, LogLevel.INFO);
  }

  async getAll(): Promise<T[]> {
    this.logger.info('Getting all items');
    return this.manager.getAll();
  }

  async create(item: T): Promise<T> {
    this.logger.info('Creating item');
    return this.manager.add(item);
  }
}

class TabService extends BaseService<BrowserTab> {
  // 자동으로 getAll, create 상속
  // 추가 메서드만 구현
}
```

---

## 6️⃣ 테스트 패턴

### Unit Test (Service)

```typescript
describe('TabService', () => {
  let service: TabService;
  let tabManager: TabManager;
  let resourceManager: ResourceManager;

  beforeEach(() => {
    tabManager = new TabManager();
    resourceManager = {
      canAllocate: jest.fn().mockReturnValue(true)
    } as unknown as ResourceManager;
    
    service = new TabService(tabManager, resourceManager);
  });

  it('should create a new tab', async () => {
    const tab = await service.createTab('https://example.com', 'Example');
    
    expect(tab.url).toBe('https://example.com');
    expect(tab.title).toBe('Example');
    expect(tab.id).toBeDefined();
  });

  it('should throw error when URL is invalid', async () => {
    await expect(
      service.createTab('invalid-url', 'Test')
    ).rejects.toThrow(ValidationError);
  });

  it('should throw error when memory is insufficient', async () => {
    resourceManager.canAllocate = jest.fn().mockReturnValue(false);
    
    await expect(
      service.createTab('https://example.com', 'Test')
    ).rejects.toThrow('Insufficient memory');
  });
});
```

### Integration Test (Handler + Service)

```typescript
describe('TabHandler', () => {
  let handler: TabHandler;
  let service: TabService;

  beforeEach(async () => {
    const tabManager = new TabManager();
    const resourceManager = new ResourceManager();
    service = new TabService(tabManager, resourceManager);
    handler = new TabHandler(service);
  });

  it('should handle tab creation via IPC', async () => {
    const response = await handler['handleCreateTab']({
      url: 'https://example.com',
      title: 'Example'
    });

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data.url).toBe('https://example.com');
    }
  });

  it('should return error response on validation failure', async () => {
    const response = await handler['handleCreateTab']({
      url: 'invalid-url',
      title: 'Test'
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    }
  });
});
```

---

## 7️⃣ 성능 최적화 패턴

### 메모리 관리

```typescript
class TabManager {
  private tabs: Map<string, BrowserTab> = new Map();
  private readonly MAX_MEMORY_MB = 500;

  public addTab(tab: BrowserTab): BrowserTab {
    const memoryUsage = this.estimateMemory();
    if (memoryUsage > this.MAX_MEMORY_MB) {
      // 오래된 탭 제거
      this.evictOldestTabs();
    }
    
    this.tabs.set(tab.id, tab);
    return tab;
  }

  private evictOldestTabs(): void {
    const sorted = Array.from(this.tabs.values())
      .sort((a, b) => a.createdAt - b.createdAt);
    
    for (const tab of sorted.slice(0, 10)) {
      this.tabs.delete(tab.id);
    }
  }

  private estimateMemory(): number {
    return this.tabs.size * 50; // 대략 50MB per tab
  }
}
```

### Lazy Loading

```typescript
class HistoryService {
  async getHistory(page = 1, pageSize = 50): Promise<HistoryEntry[]> {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    return this.historyManager.getAll()
      .slice(start, end)
      .map(entry => this.enrichEntry(entry));
  }

  private enrichEntry(entry: HistoryEntry): HistoryEntry {
    // 필요한 데이터만 조회
    return {
      ...entry,
      // 아이콘은 필요시에만 로드
      favicon: this.cache.get(entry.url) || this.loadFavicon(entry.url)
    };
  }
}
```

---

## 📌 주요 체크리스트

### 새 기능 추가 시

- [ ] **Shared에서 타입 정의** (`types/domain.ts`)
- [ ] **Manager 구현** (상태 저장)
- [ ] **Service 구현** (비즈니스 로직, 검증)
- [ ] **Handler 구현** (IPC 라우팅)
- [ ] **IPC 채널 정의** (`ipc/channels.ts`)
- [ ] **에러 클래스 추가** (필요시)
- [ ] **로깅 추가** (각 계층)
- [ ] **테스트 작성** (Unit + Integration)
- [ ] **문서 업데이트**

### 코드 리뷰 체크리스트

- [ ] SRP 준수? (각 클래스 하나의 책임)
- [ ] 의존성 주입 사용? (new 키워드 최소화)
- [ ] 에러 처리 완료? (try-catch, 에러 로깅)
- [ ] 타입 안전? (any 사용 없음)
- [ ] 테스트 있음? (최소 80% 커버리지)
- [ ] 문서 업데이트? (JSDoc 포함)
- [ ] 성능 고려? (메모리, CPU)
