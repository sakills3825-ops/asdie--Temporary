# 🗄️ Database Schema Design - Prisma + SQLite

## 📊 분석 결과

### 1️⃣ 데이터 엔티티 식별

#### Shared 레이어 (src/shared/types/domain.ts)에서:
- **BrowserTab**: 탭 정보 (id, title, url, favicon, isActive, createdAt, updatedAt)
- **HistoryEntry**: 방문 기록 (id, url, title, visitedAt, duration)
- **Bookmark**: 북마크 (id, url, title, folder, tags, createdAt)
- **AppSettings**: 앱 설정 (theme, zoomLevel, language, startPage, etc.)

#### Main 레이어 (src/main/managers, services)에서:
- **TabManager**: 탭 상태 관리 (메모리 기반 → DB로 전환 필요)
- **HistoryManager**: 방문 기록 (메모리 기반 → DB로 전환 필요)
- **HistoryService**: 방문 기록 비즈니스 로직
- **BookmarkService**: 북마크 비즈니스 로직
- **ConfigManager**: 앱 설정 저장/로드

### 2️⃣ 데이터베이스 요구사항

#### 기능적 요구사항:
1. 탭 저장 및 복원
   - 앱 종료 시 열려 있던 탭 저장
   - 앱 재시작 시 복원 (Optional)

2. 방문 기록 관리
   - URL, 제목, 방문 시간 저장
   - 최대 1000개 항목 (설정 가능)
   - 시간 범위로 검색

3. 북마크 관리
   - URL, 제목, 폴더, 태그 저장
   - 폴더별 정렬
   - 태그 기반 검색

4. 앱 설정
   - 테마, 줌 레벨, 언어 등
   - JSON으로 저장 가능

#### 비기능적 요구사항:
- 성능: 빠른 조회 (인덱싱)
- 저장소: 경량 (SQLite)
- 동기화: Main 프로세스에서만 접근
- 보안: SQL Injection 방어 (Prisma 사용으로 자동)

### 3️⃣ 관계도 분석

```
┌─────────────┐
│ BrowserTab  │ (현재 활성 탭들)
│  (volatile) │
└─────────────┘

┌──────────────┐
│ HistoryEntry │ ─── Many to One ──→ [타임 스탬프 그룹?] (Optional)
│ (1000개 제한) │
└──────────────┘

┌──────────────┐         ┌────────────┐
│  Bookmark    │ ──One to Many──→ │  BookmarkTag │
│ (폴더별 조직) │         └────────────┘
└──────────────┘

┌──────────────┐
│ AppSettings  │ (Single row, KV store)
│ (JSON BLOB)  │
└──────────────┘
```

### 4️⃣ 스키마 설계

#### 테이블 목록:

| 테이블 | 용도 | 행 수 | 업데이트 빈도 |
|--------|------|-------|-------------|
| browser_tabs | 현재 활성 탭 | ~10-50 | 자주 (탭 전환 시) |
| history_entries | 방문 기록 | 최대 1000 | 자주 (네비게이션) |
| bookmarks | 북마크 | ~100-1000 | 가끔 (사용자 추가) |
| bookmark_tags | 북마크 태그 | ~10-100 | 가끔 |
| app_settings | 앱 설정 | 1 | 거의 없음 |
| session_data | 세션 정보 | 1 | 자주 (상태 저장) |

---

## 🏗️ Prisma Schema v6.0+ (SQLite)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  // Prisma 6.0+에서 sqlite에 최적화
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ============================================================
// 현재 탭 정보 (메모리 + DB 동기화)
// ============================================================

model BrowserTab {
  /// 탭 고유 식별자 (uuid)
  id        String   @id @default(cuid())
  
  /// 탭 URL
  url       String
  
  /// 탭 제목
  title     String
  
  /// 파비콘 URL (optional)
  favicon   String?
  
  /// 활성 탭 여부
  isActive  Boolean  @default(false)
  
  /// 탭 생성 시간 (ISO 8601)
  createdAt DateTime @default(now())
  
  /// 탭 마지막 업데이트 시간
  updatedAt DateTime @updatedAt
  
  // 인덱스
  @@index([url])
  @@index([isActive])
  @@index([updatedAt])
}

// ============================================================
// 방문 기록 (히스토리)
// ============================================================

model HistoryEntry {
  /// 기록 고유 식별자
  id        String   @id @default(cuid())
  
  /// 방문한 URL
  url       String
  
  /// 페이지 제목
  title     String
  
  /// 방문 시간
  visitedAt DateTime @default(now())
  
  /// 방문 지속 시간 (밀리초)
  duration  Int      @default(0)
  
  /// 파비콘 (optional)
  favicon   String?
  
  /// 방문 횟수 카운팅용
  visits    Int      @default(1)
  
  // 인덱스 (검색 성능)
  @@index([url])
  @@index([visitedAt])
  @@index([title])
  
  // 복합 인덱스 (시간 범위 검색 최적화)
  @@index([visitedAt, url])
}

// ============================================================
// 북마크 (즐겨찾기)
// ============================================================

model Bookmark {
  /// 북마크 고유 식별자
  id        String   @id @default(cuid())
  
  /// 북마크 URL (고유값)
  url       String   @unique
  
  /// 북마크 제목
  title     String
  
  /// 폴더명 (기본: "root")
  folder    String   @default("root")
  
  /// 생성 시간
  createdAt DateTime @default(now())
  
  /// 마지막 업데이트 시간
  updatedAt DateTime @updatedAt
  
  /// 파비콘 (optional)
  favicon   String?
  
  /// 설명/메모
  description String?
  
  /// 북마크 태그 (관계)
  tags      BookmarkTag[]
  
  // 인덱스
  @@index([folder])
  @@index([createdAt])
  @@index([url])
}

// ============================================================
// 북마크 태그 (N:M 관계)
// ============================================================

model BookmarkTag {
  /// 태그 고유 식별자
  id        String   @id @default(cuid())
  
  /// 북마크 ID (외래키)
  bookmarkId String
  
  /// 북마크 (관계)
  bookmark  Bookmark @relation(fields: [bookmarkId], references: [id], onDelete: Cascade)
  
  /// 태그명
  name      String
  
  /// 생성 시간
  createdAt DateTime @default(now())
  
  // 인덱스
  @@index([bookmarkId])
  @@index([name])
  @@unique([bookmarkId, name]) // 중복 태그 방지
}

// ============================================================
// 앱 설정 (싱글 로우 KV 스토어)
// ============================================================

model AppSettings {
  /// 고정 ID (항상 1)
  id        String   @id @default("settings-1")
  
  /// 테마 (light | dark | auto)
  theme     String   @default("auto")
  
  /// 줌 레벨 (0.5 - 3.0)
  zoomLevel Float    @default(1.0)
  
  /// 언어 코드 (en, ko, etc.)
  language  String   @default("en")
  
  /// 시작 페이지 URL
  startPage String   @default("about:blank")
  
  /// 세션 복원 여부
  restorePreviousSession Boolean @default(true)
  
  /// 알림 활성화
  enableNotifications Boolean @default(true)
  
  /// 쿠키 활성화
  enableCookies Boolean @default(true)
  
  /// 캐시 크기 (MB)
  cacheSize Int      @default(500)
  
  /// 히스토리 자동 삭제 기간 (일, 0 = 안 삭제)
  historyAutoDeleteDays Int @default(0)
  
  /// 마지막 업데이트 시간
  updatedAt DateTime @updatedAt
}

// ============================================================
// 세션 데이터 (앱 상태 스냅샷)
// ============================================================

model SessionData {
  /// 고정 ID (항상 1)
  id        String   @id @default("session-1")
  
  /// 활성 탭 ID (FK to BrowserTab)
  activeTabId String?
  
  /// 마지막 닫기 전 열려있던 탭들 (JSON 배열)
  /// [{id: "...", url: "...", title: "..."}, ...]
  openTabs  String   @default("[]")
  
  /// 마지막 활성화 창 상태
  /// {width, height, isMaximized, x, y}
  windowState String?
  
  /// 마지막 활성화 시간
  lastActiveAt DateTime @default(now())
  
  /// 업데이트 시간
  updatedAt DateTime @updatedAt
}

// ============================================================
// 마이그레이션 메타데이터 (내부용)
// ============================================================

model MigrationLog {
  /// 마이그레이션 ID
  id        String   @id @default(cuid())
  
  /// 마이그레이션 이름
  name      String   @unique
  
  /// 실행 시간
  executedAt DateTime @default(now())
}
```

---

## 📋 환경 설정

### .env 파일

```bash
# 개발 환경
DATABASE_URL="file:./aside.db"

# Staging 환경
DATABASE_URL="file:./aside-staging.db"

# 프로덕션 환경
DATABASE_URL="file:$HOME/.config/aside/aside.db"
```

### .env.local (gitignore됨)

```bash
# 로컬 테스트용
DATABASE_URL="file:./aside-test.db"
```

---

## 📦 패키지 설치 계획

### Root package.json에 추가

```json
{
  "dependencies": {
    "@prisma/client": "^6.0.0"
  },
  "devDependencies": {
    "prisma": "^6.0.0"
  }
}
```

### 설치 명령

```bash
# pnpm으로 설치
pnpm add -w @prisma/client prisma@6.0.0 --save

# Prisma CLI 초기화
npx prisma init

# 마이그레이션 생성
npx prisma migrate dev --name init

# Prisma Studio (GUI)
npx prisma studio
```

---

## 🔄 마이그레이션 경로

### Phase 1: 현재 상태 (메모리 기반)
```
TabManager (메모리) → BrowserTab 엔티티 (메모리)
HistoryManager (메모리) → HistoryEntry (메모리)
BookmarkService (메모리) → Bookmark (메모리)
ConfigManager (파일 JSON) → AppSettings (DB)
```

### Phase 2: DB 마이그레이션
```
TabManager → Prisma Client 사용
HistoryManager → Prisma Client 사용
BookmarkService → Prisma Client 사용
ConfigManager → DB 읽기/쓰기
```

### Phase 3: 최적화
```
캐싱 전략 구현
인덱스 성능 모니터링
배치 작업 최적화
```

---

## 🎯 다음 단계

1. **✅ Prisma 설정**
   - prisma 패키지 설치
   - schema.prisma 파일 생성
   - 마이그레이션 파일 생성

2. **⏳ DB 레이어 구현**
   - Prisma Client 초기화
   - Repository 패턴 구현
   - DAO (Data Access Object) 생성

3. **⏳ Manager/Service 수정**
   - DB 읽기/쓰기 로직 추가
   - 기존 메모리 로직 유지 또는 제거

4. **⏳ 에러 처리**
   - Prisma 에러 매핑 (shared/errors)
   - DB 제약조건 위반 처리

5. **⏳ 테스트**
   - 유닛 테스트 작성
   - 통합 테스트 작성

---

## 📊 데이터 통계 (예상)

| 엔티티 | 행 수 | 크기 | 업데이트 |
|--------|-------|------|---------|
| BrowserTab | 10-50 | ~50 KB | 자주 |
| HistoryEntry | 1,000 | ~500 KB | 자주 |
| Bookmark | 100-1,000 | ~100 KB | 가끔 |
| BookmarkTag | 50-500 | ~50 KB | 가끔 |
| AppSettings | 1 | ~1 KB | 거의 |
| SessionData | 1 | ~10 KB | 자주 |
| **Total** | **~2,500** | **~700 KB** | - |

💾 **전체 DB 크기**: ~1-2 MB (충분히 경량)

---

## ✅ 설계 검증 체크리스트

- ✅ 모든 도메인 타입 매핑됨
- ✅ 인덱스 성능 고려 (검색, 정렬)
- ✅ 외래키 제약조건 정의
- ✅ Cascade delete 정의 (태그)
- ✅ Unique 제약조건 정의
- ✅ ISO 8601 시간 형식 (DateTime)
- ✅ 환경별 DB 경로 분리
- ✅ 마이그레이션 메타데이터
- ✅ 세션 상태 저장 계획
- ✅ Prisma v6.0+ 호환성

