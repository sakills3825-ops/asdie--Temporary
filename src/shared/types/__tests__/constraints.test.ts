/**
 * 타입 제약 조건 (Serializable, Branded Types) 테스트
 */

import {
  isSerializable,
  ensureSerializable,
  isSerializableRecord,
  createTabId,
  createUserId,
  createHistoryId,
  createBookmarkId,
  createWindowId,
  createChannelName,
  createFilePath,
  createValidatedUrl,
  createTimestamp,
  unwrapBrand,
  type Serializable,
  type TabId,
  type UserId,
} from '../constraints';

describe('Serializable 타입', () => {
  describe('isSerializable()', () => {
    it('기본 타입을 허용해야 함', () => {
      expect(isSerializable('string')).toBe(true);
      expect(isSerializable(123)).toBe(true);
      expect(isSerializable(true)).toBe(true);
      expect(isSerializable(null)).toBe(true);
    });

    it('undefined는 거부해야 함', () => {
      expect(isSerializable(undefined)).toBe(false);
    });

    it('객체를 허용해야 함', () => {
      expect(isSerializable({ name: 'Alice', age: 30 })).toBe(true);
      expect(isSerializable({ nested: { value: 123 } })).toBe(true);
    });

    it('배열을 허용해야 함', () => {
      expect(isSerializable([1, 2, 3])).toBe(true);
      expect(isSerializable([{ id: 1 }, { id: 2 }])).toBe(true);
    });

    it('Function을 거부해야 함', () => {
      expect(isSerializable(() => {})).toBe(false);
      expect(isSerializable({ fn: () => {} })).toBe(false);
    });

    it('Symbol을 거부해야 함', () => {
      expect(isSerializable(Symbol('test'))).toBe(false);
      expect(isSerializable({ sym: Symbol('test') })).toBe(false);
    });

    it('Date를 거부해야 함', () => {
      expect(isSerializable(new Date())).toBe(false);
    });

    it('RegExp를 거부해야 함', () => {
      expect(isSerializable(/test/)).toBe(false);
    });

    it('커스텀 클래스 인스턴스를 거부해야 함', () => {
      class CustomClass {}
      expect(isSerializable(new CustomClass())).toBe(false);
    });

    it('중첩된 배열과 객체를 검증해야 함', () => {
      expect(
        isSerializable({
          array: [1, 2, { nested: 'value' }],
          obj: { a: 1, b: [2, 3] },
        })
      ).toBe(true);

      expect(
        isSerializable({
          array: [1, 2, () => {}], // Function in array
        })
      ).toBe(false);
    });
  });

  describe('ensureSerializable()', () => {
    it('직렬화 가능한 값을 반환해야 함', () => {
      expect(ensureSerializable({ name: 'Alice' })).toEqual({ name: 'Alice' });
      expect(ensureSerializable([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('직렬화 불가능한 값은 에러를 던져야 함', () => {
      expect(() => ensureSerializable(() => {})).toThrow('not serializable');
      expect(() => ensureSerializable(Symbol('x'))).toThrow('not serializable');
      expect(() => ensureSerializable(undefined)).toThrow('not serializable');
    });
  });

  describe('isSerializableRecord()', () => {
    it('직렬화 가능한 Record를 허용해야 함', () => {
      expect(isSerializableRecord({ key: 'value', num: 123 })).toBe(true);
    });

    it('직렬화 불가능한 값이 있으면 거부해야 함', () => {
      expect(isSerializableRecord({ fn: () => {} })).toBe(false);
    });

    it('null이나 배열을 거부해야 함', () => {
      expect(isSerializableRecord(null)).toBe(false);
      expect(isSerializableRecord([1, 2, 3])).toBe(false);
    });
  });
});

describe('Branded Types', () => {
  describe('TabId', () => {
    it('유효한 TabId를 생성해야 함', () => {
      const tabId = createTabId('tab-123');
      expect(tabId).toBe('tab-123');
    });

    it('빈 문자열은 에러를 던져야 함', () => {
      expect(() => createTabId('')).toThrow('Invalid tab ID');
    });

    it('unwrapBrand로 원시 타입을 추출해야 함', () => {
      const tabId = createTabId('tab-123');
      const raw = unwrapBrand(tabId);
      expect(raw).toBe('tab-123');
      expect(typeof raw).toBe('string');
    });
  });

  describe('UserId', () => {
    it('유효한 UserId를 생성해야 함', () => {
      const userId = createUserId('user-456');
      expect(userId).toBe('user-456');
    });

    it('빈 문자열은 에러를 던져야 함', () => {
      expect(() => createUserId('')).toThrow('Invalid user ID');
    });
  });

  describe('HistoryId', () => {
    it('유효한 HistoryId를 생성해야 함', () => {
      const historyId = createHistoryId('history-789');
      expect(historyId).toBe('history-789');
    });
  });

  describe('BookmarkId', () => {
    it('유효한 BookmarkId를 생성해야 함', () => {
      const bookmarkId = createBookmarkId('bookmark-101');
      expect(bookmarkId).toBe('bookmark-101');
    });
  });

  describe('WindowId', () => {
    it('유효한 WindowId를 생성해야 함', () => {
      const windowId = createWindowId(123);
      expect(windowId).toBe(123);
    });

    it('음수는 에러를 던져야 함', () => {
      expect(() => createWindowId(-1)).toThrow('Invalid window ID');
    });

    it('문자열은 에러를 던져야 함', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => createWindowId('123' as any)).toThrow('Invalid window ID');
    });
  });

  describe('ChannelName', () => {
    it('유효한 ChannelName을 생성해야 함', () => {
      const channelName = createChannelName('user:login');
      expect(channelName).toBe('user:login');
    });

    it('빈 문자열은 에러를 던져야 함', () => {
      expect(() => createChannelName('')).toThrow('Invalid channel name');
    });
  });

  describe('FilePath', () => {
    it('유효한 FilePath를 생성해야 함', () => {
      const filePath = createFilePath('/path/to/file.txt');
      expect(filePath).toBe('/path/to/file.txt');
    });

    it('경로 탈출 시도는 에러를 던져야 함', () => {
      expect(() => createFilePath('../etc/passwd')).toThrow('Path traversal');
      expect(() => createFilePath('/path/../secret/file.txt')).toThrow('Path traversal');
    });

    it('빈 문자열은 에러를 던져야 함', () => {
      expect(() => createFilePath('')).toThrow('Invalid file path');
    });
  });

  describe('ValidatedUrl', () => {
    it('유효한 URL을 생성해야 함', () => {
      const url = createValidatedUrl('https://example.com');
      expect(url).toBe('https://example.com');
    });

    it('잘못된 URL은 에러를 던져야 함', () => {
      expect(() => createValidatedUrl('not-a-url')).toThrow('Invalid URL format');
      expect(() => createValidatedUrl('')).toThrow('Invalid URL');
    });

    it('프로토콜이 있는 URL만 허용해야 함', () => {
      expect(() => createValidatedUrl('example.com')).toThrow('Invalid URL format');
    });
  });

  describe('Timestamp', () => {
    it('현재 시간으로 Timestamp를 생성해야 함', () => {
      const before = Date.now();
      const timestamp = createTimestamp();
      const after = Date.now();

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('특정 시간으로 Timestamp를 생성해야 함', () => {
      const timestamp = createTimestamp(1000);
      expect(timestamp).toBe(1000);
    });

    it('음수는 에러를 던져야 함', () => {
      expect(() => createTimestamp(-1)).toThrow('Invalid timestamp');
    });
  });
});

describe('타입 안전성 (컴파일 타임)', () => {
  describe('Branded Types는 서로 호환되지 않음', () => {
    it('TabId와 UserId는 다른 타입', () => {
      const tabId: TabId = createTabId('tab-123');
      const userId: UserId = createUserId('user-456');

      // TypeScript에서는 컴파일 에러
      // const wrongAssignment: TabId = userId; // ← 타입 에러!

      // 런타임에서는 같은 string이지만 타입이 다름
      expect(typeof tabId).toBe('string');
      expect(typeof userId).toBe('string');
      expect(tabId).not.toBe(userId);
    });
  });

  describe('Serializable 타입 제약', () => {
    it('Function은 Serializable 타입에 할당 불가', () => {
      // TypeScript에서 컴파일 에러
      // const bad: Serializable = () => {}; // ← 타입 에러!

      // 런타임 검증
      expect(isSerializable(() => {})).toBe(false);
    });

    it('Symbol은 Serializable 타입에 할당 불가', () => {
      // TypeScript에서 컴파일 에러
      // const bad: Serializable = Symbol('x'); // ← 타입 에러!

      // 런타임 검증
      expect(isSerializable(Symbol('x'))).toBe(false);
    });

    it('undefined는 Serializable 타입에 할당 불가', () => {
      // TypeScript에서 컴파일 에러
      // const bad: Serializable = undefined; // ← 타입 에러!

      // 런타임 검증
      expect(isSerializable(undefined)).toBe(false);
    });
  });
});

describe('실무 시나리오', () => {
  describe('IPC 메시지 검증', () => {
    it('직렬화 가능한 메시지만 전송 가능', () => {
      const validMessage = {
        userId: 'user-123',
        action: 'login',
        timestamp: Date.now(),
      };

      expect(isSerializableRecord(validMessage)).toBe(true);
    });

    it('Function이 포함된 메시지는 거부', () => {
      const invalidMessage = {
        userId: 'user-123',
        callback: () => console.log('done'),
      };

      expect(isSerializableRecord(invalidMessage)).toBe(false);
    });
  });

  describe('에러 context 검증', () => {
    it('BaseError context는 직렬화 가능해야 함', () => {
      const context = {
        userId: 'user-123',
        timestamp: Date.now(),
        metadata: { action: 'login' },
      };

      expect(isSerializableRecord(context)).toBe(true);

      // BaseError에 전달 가능
      // new BaseError('Error', ERROR_CODES.UNKNOWN, 500, context);
    });

    it('Function이 포함된 context는 타입 에러', () => {
      const badContext = {
        userId: 'user-123',
        onError: () => {}, // ← Function
      };

      expect(isSerializableRecord(badContext)).toBe(false);

      // BaseError에 전달 시 타입 에러 (컴파일 타임)
      // new BaseError('Error', ERROR_CODES.UNKNOWN, 500, badContext); // ← 타입 에러!
    });
  });

  describe('Branded Type으로 ID 혼동 방지', () => {
    // 실무 시나리오: 탭 삭제
    function deleteTab(tabId: TabId): void {
      // tabId는 반드시 TabId 타입이어야 함
      expect(typeof tabId).toBe('string');
    }

    function deleteUser(userId: UserId): void {
      expect(typeof userId).toBe('string');
    }

    it('올바른 타입의 ID를 전달해야 함', () => {
      const tabId = createTabId('tab-123');
      deleteTab(tabId); // ✅ 정상

      const userId = createUserId('user-456');
      deleteUser(userId); // ✅ 정상
    });

    it('잘못된 타입의 ID는 컴파일 에러', () => {
      const userId = createUserId('user-456');

      // TypeScript에서 컴파일 에러
      // deleteTab(userId); // ← TabId 타입 필요, UserId 제공

      // 타입 검증 (런타임)
      expect(typeof userId).toBe('string');
    });
  });
});
