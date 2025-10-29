# 🔧 Aside QA 평가 기반 개선 액션 플랜

**평가 기준**: 실무급 프로젝트 (4.5/5 ⭐)
**목표**: 5/5 달성 및 프로덕션 레벨 품질 확보

---

## 🎯 우선순위 정리

### Priority 1: 즉시 개선 (1-2일) - 안전성 관련

| No | 항목 | 파일 | 심각도 | 작업시간 |
|----|------|------|--------|---------|
| P1-1 | Manager 반환 타입: `any` → 구체적 타입 | `src/main/managers/*` | 🔴 높음 | 30분 |
| P1-2 | Handler 입력 검증 추가 | `src/main/handlers/*` | 🔴 높음 | 1시간 |
| P1-3 | 에러 타입 확인 후 처리 | `src/main/services/*` | 🔴 높음 | 1시간 |

### Priority 2: 단기 개선 (1주일) - 테스트 커버리지

| No | 항목 | 파일 | 심각도 | 작업시간 |
|----|------|------|--------|---------|
| P2-1 | Shared 유닛 테스트 | `src/shared/__tests__/*` | 🟡 중간 | 3일 |
| P2-2 | Manager 테스트 | `src/main/__tests__/managers/*` | 🟡 중간 | 2일 |
| P2-3 | Service 테스트 | `src/main/__tests__/services/*` | 🟡 중간 | 2일 |

### Priority 3: 중기 개선 (2주일) - 코드 품질

| No | 항목 | 파일 | 심각도 | 작업시간 |
|----|------|------|--------|---------|
| P3-1 | Handler 로직 중복 제거 | `src/main/handlers/*` | 🟢 낮음 | 1일 |
| P3-2 | Logger 중복 제거 | 전체 | 🟢 낮음 | 4시간 |
| P3-3 | EventBus 리스너 자동 정리 | `src/main/core/EventBus.ts` | 🟢 낮음 | 2시간 |

---

## 📋 Priority 1: 즉시 개선 (1-2일)

### P1-1: Manager 반환 타입 개선

**현재 상태:**
```typescript
// ❌ Bad: any 사용
public async addTab(url: string, title?: string): Promise<any> {
  const tab = await this.tabRepository.create({...});
  return tab;
}
```

**개선 방안:**
```typescript
// ✅ Good: 구체적 타입
import type { BrowserTab } from '../../shared/types';

public async addTab(url: string, title?: string): Promise<BrowserTab> {
  const tab = await this.tabRepository.create({...});
  return tab as BrowserTab;
}
```

**적용 대상:**
```
src/main/managers/TabManager.ts
├── addTab()
├── removeTab()
├── getTab()
└── getAllTabs()

src/main/managers/HistoryManager.ts
├── add()
├── get()
├── delete()
└── getAll()

src/main/managers/ConfigManager.ts
├── get()
├── set()
└── delete()
```

**작업 체크리스트:**
- [ ] BrowserTab 타입 import
- [ ] HistoryEntry 타입 import
- [ ] 모든 Manager 메서드 반환 타입 업데이트
- [ ] TypeScript 컴파일 확인 (`pnpm run type-check`)

---

### P1-2: Handler 입력 검증 추가

**현재 상태:**
```typescript
// ❌ Bad: 입력 검증 없음
ipcMain.handle(IPC_CHANNELS.tabCreateNew, (_event, url: string, title?: string) =>
  this.handleCreateTab(url, title)
);
```

**개선 방안:**
```typescript
// ✅ Good: 입력 검증 추가
ipcMain.handle(IPC_CHANNELS.tabCreateNew, async (_event, url: string, title?: string) => {
  try {
    // 1. 입력 타입 검증
    if (typeof url !== 'string' || !url.trim()) {
      return IpcResponseHelper.error(
        'URL is required and must be a string',
        ERROR_CODES.VALIDATION_INVALID_FORMAT
      );
    }
    
    // 2. URL 유효성 검증
    try {
      validateUrl(url);
    } catch (error) {
      return IpcResponseHelper.error(
        error instanceof Error ? error.message : 'Invalid URL',
        ERROR_CODES.VALIDATION_INVALID_FORMAT
      );
    }
    
    // 3. 제목 검증 (선택사항)
    if (title !== undefined && (typeof title !== 'string' || title.length > 255)) {
      return IpcResponseHelper.error(
        'Title must be a string and not exceed 255 characters',
        ERROR_CODES.VALIDATION_INVALID_FORMAT
      );
    }
    
    // 4. 비즈니스 로직 처리
    return await this.handleCreateTab(url, title || url);
  } catch (error) {
    this.logger.error('TabHandler: Failed to create tab', error);
    return IpcResponseHelper.error(
      'Failed to create tab',
      ERROR_CODES.UNKNOWN
    );
  }
});
```

**적용 대상:**
```
src/main/handlers/TabHandler.ts
├── handleCreateTab()        [높음]
├── handleUpdateTab()        [중간]
├── handleSelectTab()        [중간]
└── ...

src/main/handlers/HistoryHandler.ts
├── handleAdd()              [높음]
└── ...

src/main/handlers/BookmarkHandler.ts
├── handleCreate()           [높음]
└── ...

src/main/handlers/WindowHandler.ts
├── ...
```

**작업 체크리스트:**
- [ ] ValidationError import
- [ ] validateUrl() import
- [ ] 각 Handler의 모든 IPC 핸들에 검증 추가
- [ ] 테스트 (invalid input 케이스)

---

### P1-3: 에러 타입 확인 후 처리

**현재 상태:**
```typescript
// ❌ Bad: 에러 타입 구분 없음
catch (error) {
  const err = error instanceof Error ? error : new Error(String(error));
  this.logger.error('Action: Failed', err);
  throw error;  // 원본 에러 정보 손실 가능
}
```

**개선 방안:**
```typescript
// ✅ Good: 에러 타입별 처리
catch (error) {
  // 1. BaseError 타입 (비즈니스 로직 에러)
  if (error instanceof BaseError) {
    this.logger.error('Business Logic Error', error);
    // 원본 유지 및 전파
    throw error;
  }
  
  // 2. ValidationError 타입 (검증 실패)
  if (error instanceof ValidationError) {
    this.logger.warn('Validation Error', error);
    throw error;
  }
  
  // 3. 표준 Error 타입 (런타임 에러)
  if (error instanceof Error) {
    this.logger.error('Standard Error', error);
    // AppError로 래핑
    throw new AppError(
      'Processing failed',
      ERROR_CODES.UNKNOWN,
      500,
      { originalMessage: error.message },
      error
    );
  }
  
  // 4. 알 수 없는 타입 (매우 드물지만 가능)
  this.logger.error('Unknown Error Type', new Error(String(error)));
  throw new AppError(
    'Unknown error occurred',
    ERROR_CODES.UNKNOWN,
    500,
    { originalValue: String(error) }
  );
}
```

**적용 대상:**
```
src/main/services/*.ts
├── TabService.ts
├── HistoryService.ts
├── BookmarkService.ts
├── WindowService.ts
└── ...

src/main/managers/*.ts
├── TabManager.ts
├── HistoryManager.ts
└── ...

src/main/handlers/*.ts
├── TabHandler.ts
├── HistoryHandler.ts
└── ...
```

**작업 체크리스트:**
- [ ] BaseError import
- [ ] ValidationError import
- [ ] AppError import (있으면)
- [ ] try-catch 블록 모두 업데이트
- [ ] 각 메서드에서 다양한 에러 타입 처리

---

## 📊 Priority 2: 단기 개선 (1주일)

### P2-1: Shared 유닛 테스트

**테스트 파일 생성 계획:**

#### 2-1-1. BaseError 테스트

```typescript
// src/shared/__tests__/errors/BaseError.test.ts

import { describe, it, expect } from 'vitest';
import { BaseError } from '../../errors/BaseError';
import { ERROR_CODES } from '../../constants';

describe('BaseError', () => {
  describe('constructor', () => {
    it('should create error with required properties', () => {
      const error = new BaseError('Test error', ERROR_CODES.UNKNOWN);
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ERROR_CODES.UNKNOWN);
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('BaseError');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should set correct statusCode', () => {
      const error = new BaseError('Test', ERROR_CODES.VALIDATION_ERROR, 400);
      expect(error.statusCode).toBe(400);
    });

    it('should store context if provided', () => {
      const context = { userId: '123', action: 'create' };
      const error = new BaseError('Test', ERROR_CODES.UNKNOWN, 500, context);
      expect(error.context).toEqual(context);
    });

    it('should store cause error', () => {
      const cause = new Error('Original error');
      const error = new BaseError('Test', ERROR_CODES.UNKNOWN, 500, {}, cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('instanceof', () => {
    it('should work with instanceof operator', () => {
      const error = new BaseError('Test', ERROR_CODES.UNKNOWN);
      expect(error instanceof BaseError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON', () => {
      const error = new BaseError('Test', ERROR_CODES.VALIDATION_ERROR, 400);
      const json = error.toJSON();
      
      expect(json).toHaveProperty('name', 'BaseError');
      expect(json).toHaveProperty('message', 'Test');
      expect(json).toHaveProperty('code', ERROR_CODES.VALIDATION_ERROR);
      expect(json).toHaveProperty('statusCode', 400);
      expect(json).toHaveProperty('timestamp');
    });
  });
});
```

#### 2-1-2. ValidationError 테스트

```typescript
// src/shared/__tests__/errors/AppError.test.ts

import { describe, it, expect } from 'vitest';
import { ValidationError, FileError, NetworkError } from '../../errors';
import { ERROR_CODES } from '../../constants';

describe('ValidationError', () => {
  it('should create with correct properties', () => {
    const error = new ValidationError('Invalid input');
    
    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe(ERROR_CODES.VALIDATION_INVALID_FORMAT);
    expect(error.statusCode).toBe(400);
    expect(error instanceof ValidationError).toBe(true);
  });
});

describe('FileError', () => {
  it('should create with correct properties', () => {
    const error = new FileError('File not found');
    
    expect(error.message).toBe('File not found');
    expect(error.code).toBe(ERROR_CODES.FILE_READ_ERROR);
    expect(error.statusCode).toBe(500);
  });
});

describe('NetworkError', () => {
  it('should create with correct properties', () => {
    const error = new NetworkError('Connection timeout');
    
    expect(error.message).toBe('Connection timeout');
    expect(error.code).toBe(ERROR_CODES.NETWORK_CONNECTION_FAILED);
    expect(error.statusCode).toBe(503);
  });
});
```

#### 2-1-3. Validation Utility 테스트

```typescript
// src/shared/__tests__/utils/validation.test.ts

import { describe, it, expect } from 'vitest';
import { validateUrl, isValidEmail, validateFilePath, ValidationError } from '../../utils';

describe('validateUrl', () => {
  it('should accept valid http/https URLs', () => {
    expect(() => validateUrl('https://example.com')).not.toThrow();
    expect(() => validateUrl('http://example.com')).not.toThrow();
  });

  it('should reject invalid URLs', () => {
    expect(() => validateUrl('invalid-url')).toThrow(ValidationError);
    expect(() => validateUrl('file:///etc/passwd')).not.toThrow();  // 허용되는 프로토콜
  });

  it('should reject disallowed protocols', () => {
    expect(() => validateUrl('javascript:alert("xss")')).toThrow(ValidationError);
    expect(() => validateUrl('ftp://example.com')).toThrow(ValidationError);
  });
});

describe('isValidEmail', () => {
  it('should accept valid email format', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user+tag@domain.co.uk')).toBe(true);
  });

  it('should reject invalid email format', () => {
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('test@')).toBe(false);
  });

  it('should reject emails exceeding 254 characters', () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    expect(isValidEmail(longEmail)).toBe(false);
  });
});

describe('validateFilePath', () => {
  it('should reject path traversal attempts', () => {
    expect(() => validateFilePath('../etc/passwd')).toThrow(ValidationError);
    expect(() => validateFilePath('..\\windows\\system32')).toThrow(ValidationError);
  });

  it('should reject absolute paths', () => {
    expect(() => validateFilePath('/etc/passwd')).toThrow(ValidationError);
    expect(() => validateFilePath('C:\\Windows\\System32')).toThrow(ValidationError);
  });

  it('should accept relative paths', () => {
    expect(() => validateFilePath('uploads/image.png')).not.toThrow();
    expect(() => validateFilePath('documents/report.pdf')).not.toThrow();
  });
});
```

#### 2-1-4. IPC Types 테스트

```typescript
// src/shared/__tests__/ipc/types.test.ts

import { describe, it, expect } from 'vitest';
import { IpcResponseHelper, type IpcResponse } from '../../ipc';

describe('IpcResponseHelper', () => {
  describe('success', () => {
    it('should create success response', () => {
      const response = IpcResponseHelper.success({ id: '123' });
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: '123' });
    });

    it('should work with empty data', () => {
      const response = IpcResponseHelper.success();
      expect(response.success).toBe(true);
    });
  });

  describe('error', () => {
    it('should create error response', () => {
      const response = IpcResponseHelper.error('Something went wrong', 'E_UNKNOWN');
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Something went wrong');
      expect(response.code).toBe('E_UNKNOWN');
    });
  });

  describe('type narrowing', () => {
    it('should narrow types correctly', () => {
      const response: IpcResponse<string> = IpcResponseHelper.success('data');
      
      if (response.success) {
        // TypeScript should recognize response.data exists
        const data: string = response.data;
        expect(data).toBe('data');
      }
    });
  });
});
```

**작업 체크리스트:**
- [ ] `src/shared/__tests__/errors/BaseError.test.ts` 작성
- [ ] `src/shared/__tests__/errors/AppError.test.ts` 작성
- [ ] `src/shared/__tests__/utils/validation.test.ts` 작성
- [ ] `src/shared/__tests__/ipc/types.test.ts` 작성
- [ ] `pnpm test` 실행 및 모든 테스트 통과 확인

---

### P2-2: Manager 테스트

**테스트 예제:**

```typescript
// src/main/__tests__/managers/TabManager.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabManager } from '../../managers/TabManager';

describe('TabManager', () => {
  let mockRepository: any;
  let manager: TabManager;

  beforeEach(() => {
    mockRepository = {
      create: vi.fn(async (data) => ({ id: 'tab-1', ...data })),
      findById: vi.fn(async () => ({ id: 'tab-1', url: 'https://example.com' })),
      findAll: vi.fn(async () => [{ id: 'tab-1' }]),
      delete: vi.fn(async () => true),
      update: vi.fn(async () => ({ id: 'tab-1' })),
    };
    manager = TabManager.create(mockRepository);
  });

  describe('addTab', () => {
    it('should add tab successfully', async () => {
      const tab = await manager.addTab('https://example.com', 'Example');
      
      expect(mockRepository.create).toHaveBeenCalledWith({
        url: 'https://example.com',
        title: 'Example',
        isActive: false,
      });
      expect(tab.id).toBe('tab-1');
    });

    it('should use URL as title if title not provided', async () => {
      await manager.addTab('https://example.com');
      
      expect(mockRepository.create).toHaveBeenCalledWith({
        url: 'https://example.com',
        title: 'New Tab',
        isActive: false,
      });
    });

    it('should throw error if repository fails', async () => {
      mockRepository.create.mockRejectedValueOnce(new Error('DB error'));
      
      await expect(manager.addTab('https://example.com')).rejects.toThrow('DB error');
    });
  });

  describe('removeTab', () => {
    it('should remove tab successfully', async () => {
      const result = await manager.removeTab('tab-1');
      
      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('tab-1');
    });

    it('should return false if tab not found', async () => {
      mockRepository.delete.mockResolvedValueOnce(null);
      
      const result = await manager.removeTab('tab-1');
      expect(result).toBe(false);
    });
  });

  describe('getTab', () => {
    it('should get tab by ID', async () => {
      const tab = await manager.getTab('tab-1');
      
      expect(tab.id).toBe('tab-1');
      expect(mockRepository.findById).toHaveBeenCalledWith('tab-1');
    });
  });
});
```

**작업 체크리스트:**
- [ ] TabManager 테스트 작성
- [ ] HistoryManager 테스트 작성
- [ ] ResourceManager 테스트 작성
- [ ] ConfigManager 테스트 작성
- [ ] 모든 Manager 메서드에 대한 테스트 커버리지 확보

---

### P2-3: Service 테스트

**테스트 예제:**

```typescript
// src/main/__tests__/services/TabService.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabService } from '../../services/TabService';
import { ValidationError } from '../../../shared/errors';

describe('TabService', () => {
  let mockTabManager: any;
  let mockResourceManager: any;
  let service: TabService;

  beforeEach(() => {
    mockTabManager = {
      addTab: vi.fn(async () => ({ id: 'tab-1', url: 'https://example.com' })),
      removeTab: vi.fn(async () => true),
      getTab: vi.fn(async () => ({ id: 'tab-1' })),
      getAllTabs: vi.fn(async () => []),
    };

    mockResourceManager = {
      canAllocate: vi.fn(() => true),
      getMetrics: vi.fn(() => ({ used: 100, total: 500 })),
    };

    service = new TabService(mockTabManager, mockResourceManager);
  });

  describe('createTab', () => {
    it('should create tab successfully', async () => {
      const tab = await service.createTab('https://example.com', 'Example');
      
      expect(tab.id).toBe('tab-1');
      expect(mockTabManager.addTab).toHaveBeenCalled();
    });

    it('should throw error if memory insufficient', async () => {
      mockResourceManager.canAllocate.mockReturnValueOnce(false);
      
      await expect(
        service.createTab('https://example.com')
      ).rejects.toThrow('메모리 부족');
    });

    it('should throw error if URL validation fails', async () => {
      // URL 검증 로직이 Service에 있으면 테스트
      await expect(
        service.createTab('invalid-url')
      ).rejects.toThrow();
    });
  });

  describe('closeTab', () => {
    it('should close tab successfully', async () => {
      await service.closeTab('tab-1');
      
      expect(mockTabManager.removeTab).toHaveBeenCalledWith('tab-1');
    });

    it('should throw error if tab not found', async () => {
      mockTabManager.removeTab.mockResolvedValueOnce(false);
      
      await expect(service.closeTab('tab-1')).rejects.toThrow();
    });
  });
});
```

**작업 체크리스트:**
- [ ] TabService 테스트 작성
- [ ] HistoryService 테스트 작성
- [ ] BookmarkService 테스트 작성
- [ ] WindowService 테스트 작성
- [ ] 에러 케이스 모두 테스트

---

## 🎯 Priority 3: 중기 개선 (2주일)

### P3-1: Handler 로직 중복 제거

**현재 상태:**
```typescript
// ❌ Each handler has similar structure
class TabHandler {
  registerHandlers(): void {
    ipcMain.handle(channel1, (_, args) => this.method1(args));
    ipcMain.handle(channel2, (_, args) => this.method2(args));
  }
}

class HistoryHandler {
  registerHandlers(): void {
    ipcMain.handle(channel3, (_, args) => this.method3(args));
    ipcMain.handle(channel4, (_, args) => this.method4(args));
  }
}
```

**개선 방안:**
```typescript
// ✅ Good: Base handler class with common logic
abstract class BaseHandler<TService> {
  protected logger: ILogger;

  constructor(protected service: TService) {
    this.logger = new LoggerImpl(this.constructor.name, LogLevel.INFO);
  }

  protected registerHandler<TArgs, TResponse>(
    channel: string,
    handler: (args: TArgs) => Promise<IpcResponse<TResponse>>
  ): void {
    ipcMain.handle(channel, async (_event, args: TArgs) => {
      try {
        return await handler(args);
      } catch (error) {
        this.logger.error(`Handler failed: ${channel}`, error as Error);
        return IpcResponseHelper.error(
          error instanceof Error ? error.message : 'Unknown error',
          ERROR_CODES.UNKNOWN
        );
      }
    });
  }

  abstract registerHandlers(): void;
}

// ✅ Usage
class TabHandler extends BaseHandler<ITabService> {
  registerHandlers(): void {
    this.registerHandler('tab:create', (args) => this.handleCreate(args));
    this.registerHandler('tab:delete', (args) => this.handleDelete(args));
  }

  private async handleCreate(args: any): Promise<IpcResponse<BrowserTab>> {
    const tab = await this.service.createTab(args.url);
    return IpcResponseHelper.success(tab);
  }
}
```

**작업 체크리스트:**
- [ ] `src/main/handlers/BaseHandler.ts` 작성
- [ ] 모든 Handler 클래스 BaseHandler 상속으로 변경
- [ ] registerHandler() 메서드 사용으로 통일
- [ ] 테스트 실행 및 확인

---

### P3-2: Logger 중복 제거

**현재 상태:**
```typescript
// ❌ Repetitive logging code
logger.info('TabManager: Tab added', {
  module: 'TabManager',
  metadata: { tabId: tab.id }
});

logger.info('TabManager: Tab removed', {
  module: 'TabManager',
  metadata: { tabId }
});
```

**개선 방안:**
```typescript
// ✅ Good: Logging helper methods
abstract class BaseComponent {
  protected logger: ILogger;

  protected logAction(action: string, metadata?: Record<string, unknown>): void {
    this.logger.info(`${this.componentName}: ${action}`, {
      module: this.componentName,
      metadata
    });
  }

  protected logError(action: string, error: Error, metadata?: Record<string, unknown>): void {
    this.logger.error(`${this.componentName}: ${action}`, error, {
      module: this.componentName,
      metadata
    });
  }

  protected get componentName(): string {
    return this.constructor.name;
  }
}

// ✅ Usage
class TabManager extends BaseComponent {
  async addTab(url: string): Promise<BrowserTab> {
    try {
      const tab = await this.tabRepository.create({ url });
      this.logAction('Tab added', { tabId: tab.id });
      return tab;
    } catch (error) {
      this.logError('Failed to add tab', error as Error, { url });
      throw error;
    }
  }
}
```

**작업 체크리스트:**
- [ ] `src/main/core/BaseComponent.ts` 작성 (로깅 헬퍼)
- [ ] 모든 Manager 클래스 BaseComponent 상속 변경
- [ ] 모든 Service 클래스 BaseComponent 상속 변경
- [ ] 로깅 코드 간결화
- [ ] 테스트 실행 및 확인

---

### P3-3: EventBus 리스너 자동 정리

**현재 상태:**
```typescript
// ❌ Manual listener management
class EventBus {
  on(event: string, listener: Function): void {
    this.listeners.get(event)?.push(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    }
  }
}

// 사용자가 수동으로 off() 호출해야 함
eventBus.on('tab:created', handler);
// ... 나중에
eventBus.off('tab:created', handler);  // ← 까먹기 쉬움
```

**개선 방안:**
```typescript
// ✅ Good: Automatic cleanup via unsubscribe function
class EventBus {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, listener: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Unsubscribe 함수 반환
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  once(event: string, listener: Function): () => void {
    const wrappedListener = (data: unknown) => {
      listener(data);
      unsubscribe();
    };

    const unsubscribe = this.on(event, wrappedListener);
    return unsubscribe;
  }

  emit(event: string, data?: unknown): void {
    this.listeners.get(event)?.forEach(listener => {
      try {
        (listener as Function)(data);
      } catch (error) {
        this.logger.error(`Error in event listener for ${event}`, error as Error);
      }
    });
  }
}

// ✅ Usage: 자동 정리
const unsubscribe = eventBus.on('tab:created', (tab) => {
  console.log('Tab created:', tab);
});

// 정리할 때
unsubscribe();
```

**작업 체크리스트:**
- [ ] EventBus의 listeners를 Set으로 변경
- [ ] on() 메서드가 unsubscribe 함수 반환하도록 수정
- [ ] once() 메서드 동일하게 수정
- [ ] 에러 처리 추가 (리스너에서 발생한 에러)
- [ ] 테스트 작성 및 실행

---

## 📈 진행도 추적 (Progress Tracking)

### 일주일 별 목표

#### 1주차: Priority 1 완료
- [ ] P1-1: Manager 반환 타입 개선 (30분)
- [ ] P1-2: Handler 입력 검증 (1시간)
- [ ] P1-3: 에러 타입 확인 처리 (1시간)
- [ ] 테스트 및 검증 (30분)
- **예상 시간: 3시간**

#### 2-3주차: Priority 2 완료
- [ ] P2-1: Shared 유닛 테스트 (3일)
- [ ] P2-2: Manager 테스트 (2일)
- [ ] P2-3: Service 테스트 (2일)
- **예상 시간: 1주일**

#### 4주차: Priority 3 완료
- [ ] P3-1: Handler 로직 중복 제거 (1일)
- [ ] P3-2: Logger 중복 제거 (4시간)
- [ ] P3-3: EventBus 리스너 자동 정리 (2시간)
- **예상 시간: 1.5일**

---

## ✅ 최종 체크리스트

### 배포 전 확인 항목

- [ ] 모든 타입 안전성 확보 (`any` 제거)
- [ ] 모든 IPC 핸들러에 입력 검증 추가
- [ ] 에러 타입별 처리 구현
- [ ] Shared 유닛 테스트 커버리지 > 80%
- [ ] Manager 테스트 커버리지 > 80%
- [ ] Service 테스트 커버리지 > 80%
- [ ] 통합 테스트 실행 및 통과
- [ ] `pnpm test` 실행 및 모두 통과
- [ ] `pnpm type-check` 실행 및 오류 없음
- [ ] `pnpm lint` 실행 및 경고 없음
- [ ] README 업데이트 (테스트 방법 추가)

---

## 📝 배포 체크리스트

```bash
# 1. 타입 안전성 확인
pnpm type-check

# 2. 린트 확인
pnpm lint

# 3. 모든 테스트 실행
pnpm test

# 4. 테스트 커버리지 확인
pnpm test:coverage

# 5. 빌드 확인
pnpm build

# 6. Git 상태 확인
git status
git diff

# 7. Codacy 분석 (선택사항)
# Codacy CLI 실행 또는 CI/CD에서 자동 실행
```

---

**예상 완료일: 약 4주 (Priority 1 포함)**

이 계획을 따르면 프로젝트가 완전한 실무급 코드로 업그레이드될 것입니다! 🚀
