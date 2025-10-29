# 🔐 Environment Configuration Guide

## 📋 파일 구조

```
.env                      # 기본값 (모든 환경이 사용)
.env.development         # 개발 환경 (npm run dev)
.env.staging             # Staging 환경 (배포 전 테스트)
.env.production          # 프로덕션 환경 (실제 배포)
.env.local              # 로컬 개인 설정 (git 무시)
.env.{NODE_ENV}.local   # 환경별 개인 설정 (git 무시)
```

## 🔄 우선순위

```
.env.{NODE_ENV}.local  ← 최고 우선순위 (로컬 개인 설정)
        ↓
.env.{NODE_ENV}        ← 환경별 공식 설정
        ↓
.env.local             ← 로컬 개인 설정
        ↓
.env                   ← 기본값 (최하 우선순위)
```

**예시 (개발 환경에서 실행):**
```
NODE_ENV=development
  ↓
로드 순서:
1. .env.development.local (있으면)
2. .env.development
3. .env.local (있으면)
4. .env
```

## ⚙️ 포트 선택 가이드

### Main Process Port

| 환경 | 포트 | 범위 | 용도 |
|------|------|------|------|
| Development | 9000 | 49152-65535 | 개발/테스트 |
| Staging | 54322 | 49152-65535 | 배포 전 테스트 |
| Production | 54321 | 49152-65535 | 실제 배포 |

**포트 선택 기준:**
- ✅ 49152-65535: Dynamic/Private ports (권장)
- ❌ 1-1023: Privileged ports (피함)
- ❌ 3000, 5173, 8000, 8080 등: 일반적으로 사용 중인 포트 (피함)

**포트 충돌 확인:**
```bash
# macOS/Linux
lsof -i :9000
lsof -i :54321

# Windows
netstat -ano | findstr :9000
```

## 🔧 환경별 설정 비교

### 로깅 레벨

| 환경 | 레벨 | 설명 |
|------|------|------|
| Development | `debug` | 모든 로그 출력 (개발 디버깅용) |
| Staging | `info` | 정보 + 경고 + 에러 |
| Production | `warn` | 경고 + 에러만 출력 |

### 보안 설정

| 설정 | Development | Staging | Production |
|------|-------------|---------|------------|
| CSP | ✅ 활성화 | ✅ 활성화 | ✅ 활성화 (필수) |
| DevTools | ✅ 활성화 | ❌ 비활성화 | ❌ 비활성화 |
| unsafe-inline | ❌ 금지 | ❌ 금지 | ❌ 금지 (필수) |

### 캐시 설정

| 환경 | 활성화 | 크기 | 용도 |
|------|--------|------|------|
| Development | ✅ | 500MB | 빠른 개발 |
| Staging | ✅ | 1000MB | 프로덕션 테스트 |
| Production | ✅ | 1000MB | 최종 사용자 환경 |

## 🚀 사용 방법

### 1️⃣ 개발 환경 실행

```bash
# .env.development 로드됨 (자동)
npm run dev
```

### 2️⃣ 프로덕션 빌드

```bash
# .env.production 로드됨 (자동)
npm run build
```

### 3️⃣ Staging 빌드

```bash
# NODE_ENV를 staging으로 설정
NODE_ENV=staging npm run build
```

### 4️⃣ 로컬 개인 설정 (git 무시됨)

```bash
# .env.local 생성 (모든 환경에서 사용)
echo "VITE_LOG_LEVEL=trace" >> .env.local

# 또는 환경별 개인 설정
echo "MAIN_PROCESS_PORT=9001" >> .env.development.local
```

## 📝 주요 환경 변수

### 필수 설정

| 변수 | 설명 | 사용처 |
|------|------|--------|
| `NODE_ENV` | 실행 환경 | Electron, Vite, 빌드 스크립트 |
| `VITE_LOG_LEVEL` | 로그 레벨 | Logger 필터링 |
| `DATABASE_URL` | 데이터베이스 경로 | ConfigManager, DB 초기화 |

### 선택적 설정

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `VITE_ENABLE_CSP` | true | Content Security Policy 활성화 |
| `VITE_ENABLE_DEVTOOLS` | false | 개발자 도구 활성화 |
| `VITE_ENABLE_CACHING` | true | 캐시 시스템 활성화 |

## ⚠️ 주의사항

### `.env.local` / `.env.{NODE_ENV}.local`
- 🔒 **Git에 커밋하지 마세요**
- 개인 환경 설정용 (API 키, 로컬 DB 경로 등)
- `.gitignore`에 이미 추가됨

### 프로덕션 배포 체크리스트

```
❌ VITE_ENABLE_DEVTOOLS=true인지 확인
❌ VITE_ALLOW_UNSAFE_INLINE=true인지 확인
✅ NODE_ENV=production인지 확인
✅ VITE_LOG_LEVEL=warn인지 확인
✅ VITE_ENABLE_CSP=true인지 확인
```

## 🔍 트러블슈팅

### 환경 변수가 반영되지 않음

```bash
# 1. .env 파일 확인
cat .env

# 2. NODE_ENV 확인
echo $NODE_ENV

# 3. 캐시 삭제 후 재빌드
rm -rf dist node_modules/.vite
npm run build
```

### 포트 충돌 에러

```bash
# 포트 사용 확인
lsof -i :54321

# 포트 변경 (임시)
MAIN_PROCESS_PORT=54323 npm run build
```

### 데이터베이스 경로 오류

```bash
# .env.production에서
DATABASE_URL=file:./aside.db  # ❌ 상대 경로 사용 금지
DATABASE_URL=file:~/.config/aside/aside.db  # ⚠️ tilde 지원 안 될 수도
DATABASE_URL=file:/Users/user/.config/aside/aside.db  # ✅ 절대 경로 권장
```

## 📚 참고

- Vite Env: https://vitejs.dev/guide/env-and-modes.html
- Node.js Environment: https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
- Dynamic Ports: https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers#Dynamic,_private_or_ephemeral_ports
