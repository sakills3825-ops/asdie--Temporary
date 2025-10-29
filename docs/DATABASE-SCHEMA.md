# 📊 Aside 데이터베이스 스키마 가이드

## 개요

Aside는 **Prisma ORM**을 통해 **SQLite** 기반의 로컬 데이터베이스를 사용합니다.

```
aside.db (SQLite)
├── BrowserTab (현재 열린 탭)
├── BrowserHistory (방문 기록)
├── Bookmark (북마크)
└── AppSettings (앱 설정 - 선택사항)
```

---

## 🗂️ 데이터베이스 모델

### 1. BrowserTab (브라우저 탭)

**용도:** 현재 열린 탭 정보 저장 및 복구

```typescript
model BrowserTab {
  id          String   @id @default(cuid())
  url         String   @unique
  title       String   @default("")
  favicon     String?  // 파비콘 URL
  isActive    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([isActive])
  @@index([updatedAt])
}
```

**주요 필드:**
- `id`: 유니크 탭 ID
- `url`: 탭 URL (unique)
- `title`: 탭 제목
- `favicon`: 파비콘 URL
- `isActive`: 현재 활성 탭 여부
- `createdAt`: 생성 시간
- `updatedAt`: 마지막 수정 시간

**인덱스:**
- `isActive` 인덱스: 활성 탭 빠른 조회
- `updatedAt` 인덱스: 최근 탭 정렬

---

### 2. BrowserHistory (방문 기록)

**용도:** 사용자 방문 기록 저장 및 검색

```typescript
model BrowserHistory {
  id          String   @id @default(cuid())
  url         String   @index
  title       String   @default("")
  visitedAt   BigInt   // 방문 시간 (timestamp)
  duration    Int?     // 방문 지속 시간 (초)
  createdAt   DateTime @default(now())

  @@index([visitedAt])
  @@index([url, visitedAt])
}
```

**주요 필드:**
- `id`: 유니크 기록 ID
- `url`: 방문한 URL (인덱스)
- `title`: 페이지 제목
- `visitedAt`: 방문 시간 (timestamp)
- `duration`: 방문 지속 시간 (초)

**인덱스:**
- `url`: URL로 기록 검색
- `visitedAt`: 날짜 범위 검색
- `(url, visitedAt)`: 복합 인덱스 (같은 URL의 방문 기록 빠른 조회)

---

### 3. Bookmark (북마크)

**용도:** 사용자 북마크 저장 및 폴더 관리

```typescript
model Bookmark {
  id          String   @id @default(cuid())
  url         String   @index
  title       String
  description String?
  folder      String   @default("default") @index // 폴더명
  tags        String[] @default([]) // 태그 배열
  favicon     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([folder])
  @@index([url, folder])
}
```

**주요 필드:**
- `id`: 유니크 북마크 ID
- `url`: 북마크 URL (인덱스)
- `title`: 북마크 제목
- `description`: 설명
- `folder`: 폴더 (기본값: "default")
- `tags`: 태그 배열 (JSON)
- `favicon`: 파비콘 URL

**인덱스:**
- `url`: URL 검색
- `folder`: 폴더별 조회
- `(url, folder)`: 폴더 내 URL 검색

---

## 🔄 Repository 패턴

### TabRepository

```typescript
// 모든 탭 조회
async findAll(): Promise<BrowserTab[]>

// ID로 탭 조회
async findById(id: string): Promise<BrowserTab | null>

// URL로 탭 조회
async findByUrl(url: string): Promise<BrowserTab | null>

// 활성 탭 조회
async findActive(): Promise<BrowserTab[]>

// 탭 생성
async create(data: Omit<BrowserTab, 'id' | 'createdAt' | 'updatedAt'>): Promise<BrowserTab>

// 탭 수정
async update(id: string, data: Partial<BrowserTab>): Promise<BrowserTab>

// 탭 삭제
async delete(id: string): Promise<BrowserTab>

// 활성 탭 설정 (하나만 활성)
async setActive(tabId: string): Promise<void>

// 배치 생성
async createMany(items: Array<...>): Promise<{ count: number }>
```

### HistoryRepository

```typescript
// 모든 기록 조회
async findAll(limit?: number): Promise<BrowserHistory[]>

// 검색
async search(query: string, limit?: number): Promise<BrowserHistory[]>

// 날짜 범위 조회
async findByDateRange(startTime: number, endTime: number): Promise<BrowserHistory[]>

// 자주 방문한 사이트
async getFrequentSites(limit?: number): Promise<{ url: string; count: number }[]>

// 생성, 수정, 삭제...
```

### BookmarkRepository

```typescript
// 폴더별 조회
async findByFolder(folder: string): Promise<Bookmark[]>

// 태그로 검색
async findByTag(tag: string): Promise<Bookmark[]>

// 키워드 검색
async search(query: string): Promise<Bookmark[]>

// 폴더 목록
async getFolders(): Promise<string[]>

// 모든 태그
async getAllTags(): Promise<string[]>

// 생성, 수정, 삭제...
```

---

## 🚀 사용 예시

### DatabaseService 초기화

```typescript
import { DatabaseService } from './services/database/DatabaseService';

const db = DatabaseService.getInstance();
const tabRepo = db.getTabRepository();
const historyRepo = db.getHistoryRepository();
const bookmarkRepo = db.getBookmarkRepository();
```

### 탭 조회 및 생성

```typescript
// 모든 탭 조회
const tabs = await tabRepo.findAll();

// 새 탭 생성
const newTab = await tabRepo.create({
  url: 'https://example.com',
  title: 'Example'
});

// 활성 탭 설정
await tabRepo.setActive(newTab.id);
```

### 방문 기록 검색

```typescript
// 키워드로 검색
const results = await historyRepo.search('google', 50);

// 자주 방문한 사이트
const frequent = await historyRepo.getFrequentSites(10);

// 날짜 범위 조회 (최근 7일)
const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
const week = await historyRepo.findByDateRange(sevenDaysAgo, Date.now());
```

### 북마크 관리

```typescript
// 폴더별 북마크
const workBookmarks = await bookmarkRepo.findByFolder('work');

// 태그로 검색
const reactBookmarks = await bookmarkRepo.findByTag('react');

// 새 북마크 생성
const bookmark = await bookmarkRepo.create({
  url: 'https://react.dev',
  title: 'React Documentation',
  folder: 'tech',
  tags: ['react', 'javascript']
});

// 모든 폴더 조회
const folders = await bookmarkRepo.getFolders();

// 모든 태그 조회
const tags = await bookmarkRepo.getAllTags();
```

---

## 🔧 마이그레이션

### 새로운 마이그레이션 생성

```bash
# Schema 수정 후
$ pnpm prisma migrate dev --name <migration_name>
```

### 기본 마이그레이션

```bash
# 개발 환경 마이그레이션
$ pnpm run db:migrate

# 프로덕션 빌드 마이그레이션
$ pnpm prisma migrate deploy
```

### 마이그레이션 히스토리

```bash
$ pnpm prisma migrate status
```

---

## 📍 파일 위치

| 환경 | 경로 |
|------|------|
| 개발 | `./prisma/dev.db` |
| 프로덕션 (macOS/Linux) | `~/.config/aside/aside.db` |
| 프로덕션 (Windows) | `%APPDATA%\aside\aside.db` |

---

## 🔐 보안 고려사항

1. **데이터 암호화 (선택):** 민감한 데이터는 Prisma Encrypt 사용
2. **접근 제어:** 모든 쿼리는 Repository를 통해서만 수행
3. **입력 검증:** IPC 핸들러에서 데이터 검증
4. **로깅:** 중요 작업은 로깅 (감시 및 감사)

---

## 📊 성능 최적화

### 인덱싱 전략

- **자주 검색되는 필드:** `url`, `folder`, `visitedAt`
- **복합 인덱스:** `(url, visitedAt)` (같은 URL의 히스토리 조회)
- **정렬:** `createdAt DESC`, `updatedAt DESC`

### 쿼리 최적화

```typescript
// 좋은 예: limit 사용
const recent = await historyRepo.findAll(50);

// 나쁜 예: 모든 데이터 로드
const all = await historyRepo.findAll();
```

### 캐싱 전략

- 자주 접근하는 데이터: CacheManager로 메모리 캐싱
- 중요 데이터: aside.db (Prisma) 영속성

---

## 🔄 데이터 일관성

### 트랜잭션 (필요시)

```typescript
// 배치 작업 트랜잭션
await prisma.$transaction([
  prisma.browserTab.deleteMany(),
  prisma.browserTab.createMany({ data: newTabs })
]);
```

### 외래 키 무결성

현재 모델은 외래 키 관계를 사용하지 않음 (간단한 구조).
필요시 추후 추가 가능.

---

## 📚 참고 자료

- [Prisma 공식 문서](https://www.prisma.io/docs/)
- [SQLite 공식 문서](https://www.sqlite.org/docs.html)
- [Aside Repository Pattern](../services/database/README.md)
