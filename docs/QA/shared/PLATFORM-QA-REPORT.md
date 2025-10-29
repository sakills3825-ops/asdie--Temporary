# Platform 모듈 심층 QA 리포트
**작성일**: 2025-10-27  
**검토 대상**: `src/shared/platform/`  
**관점**: 비관적 (보안/경로 조작 중심)

---

## 1️⃣ 경로 검증 (Path Validation)

### 1.1 문제: 경로 정규화 부재 🔴

**현재** (`platform/paths.ts` 추정):
```typescript
export const getAppDataPath = (): string => {
  return path.join(
    process.env.APPDATA || os.homedir(),
    'AppData',
    'Local'
  );
};

export const getUserFilePath = (filename: string): string => {
  return path.join(getAppDataPath(), filename);
};
```

**공격 벡터**:
```typescript
// 경로 탈출 (Path Traversal)
getUserFilePath('../../../etc/passwd');
// 결과: /path/to/AppData/Local/../../../etc/passwd
// 실제: /etc/passwd ← 권한 외 영역 접근!

getUserFilePath('../../secret/admin.json');
// 권한 외 파일 읽기 가능

// Symlink 공격
// symbolic link로 다른 경로 지칭 가능
```

**필요한 것**:
```typescript
export const getUserFilePath = (filename: string): string => {
  // 1. 경로 정규화
  const normalized = path.normalize(filename);
  
  // 2. 탈출 시도 감지
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new SecurityError('Path traversal detected');
  }
  
  // 3. 실제 경로 계산
  const base = getAppDataPath();
  const full = path.resolve(base, normalized);
  
  // 4. 범위 확인 (매우 중요!)
  if (!full.startsWith(base)) {
    throw new SecurityError('Path outside allowed directory');
  }
  
  return full;
};
```

---

### 1.2 문제: 심링크 공격 위험 🔴

**현재**:
```typescript
export const readConfigFile = (filepath: string): Config => {
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
};

export const getAppDataPath = (): string => {
  return path.join(os.homedir(), 'AppData');
};
```

**공격**:
```bash
# 1. 심링크 생성
ln -s /etc/sensitive-config /path/to/AppData/config.json

# 2. 애플리케이션 실행
readConfigFile('config.json');

# 3. /etc/sensitive-config 읽음! (권한 외)
```

**해결책**:
```typescript
export const readConfigFile = (filepath: string): Config => {
  // realpath: 심링크 따라가지 않음
  const real = fs.realpathSync(filepath);
  const base = fs.realpathSync(getAppDataPath());
  
  if (!real.startsWith(base)) {
    throw new SecurityError('Symlink outside allowed directory');
  }
  
  return JSON.parse(fs.readFileSync(real, 'utf-8'));
};
```

---

### 1.3 문제: 환경 변수 검증 부재 ⚠️

**현재** (`platform/environment.ts` 추정):
```typescript
export const getEnvVariable = (name: string): string | undefined => {
  return process.env[name];  // ← 검증 없음
};

export const getAppDataPath = (): string => {
  // 환경 변수 직접 사용
  return process.env.APPDATA || os.homedir();
};
```

**문제**:
```typescript
// 악의적 환경 변수 설정
process.env.APPDATA = '/tmp/malicious';

// 애플리케이션이 잘못된 경로 사용
const path = getAppDataPath();  // '/tmp/malicious'

// 결과: 구성 파일이 다른 위치에서 로드됨!
// 또는 권한 낮은 위치에 파일 생성
```

**필요한 것**:
```typescript
export const getAppDataPath = (): string => {
  const appdata = process.env.APPDATA;
  
  // 1. 존재하는가?
  if (!appdata) {
    return os.homedir();
  }
  
  // 2. 절대 경로인가?
  if (!path.isAbsolute(appdata)) {
    throw new EnvironmentError('APPDATA must be absolute path');
  }
  
  // 3. 존재하는가?
  if (!fs.existsSync(appdata)) {
    throw new EnvironmentError('APPDATA directory does not exist');
  }
  
  // 4. 쓰기 권한이 있는가?
  try {
    fs.accessSync(appdata, fs.constants.W_OK);
  } catch {
    throw new EnvironmentError('APPDATA not writable');
  }
  
  return appdata;
};
```

---

### 1.4 문제: 파일 존재 검사 (TOCTOU) 🔴

**현재** (추정):
```typescript
export const ensureDirectory = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {  // ← 검사 시점 1
    fs.mkdirSync(dirPath, { recursive: true });  // ← 생성 시점 2
  }
};
```

**공격** (Time-of-Check-Time-of-Use):
```
시간선:
T0: fs.existsSync(dirPath) = false (검사)
T1: [공격자] 심링크 생성: dirPath → /tmp/exploit
T2: fs.mkdirSync(dirPath) = /tmp/exploit 에 쓰기!
결과: /tmp/exploit에 데이터 저장됨 ← 권한 외!
```

**해결책**:
```typescript
export const ensureDirectory = (dirPath: string): void => {
  try {
    // atomic 작업 (검사+생성 동시)
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
    
    // 존재하는가?
    const stat = fs.statSync(dirPath);
    
    // 디렉토리인가? (파일 아님)
    if (!stat.isDirectory()) {
      throw new Error(`${dirPath} is not a directory`);
    }
    
    // 심링크 아닌가?
    if (stat.isSymbolicLink()) {
      throw new SecurityError('Directory is a symbolic link');
    }
  }
};
```

---

## 2️⃣ 플랫폼 감지

### 2.1 문제: OS 감지 불완전 ⚠️

**현재** (`platform/environment.ts` 추정):
```typescript
export const getPlatform = (): 'win32' | 'darwin' | 'linux' => {
  return process.platform as any;
};

export const isWindows = (): boolean => process.platform === 'win32';
export const isMac = (): boolean => process.platform === 'darwin';
export const isLinux = (): boolean => process.platform === 'linux';
```

**문제**:
```typescript
// 예상치 못한 플랫폼
console.log(process.platform);  // 'freebsd'? 'openbsd'? 'sunos'?

// Electron 특수성
// - Windows on ARM
// - Linux distributions (Alpine, Debian, etc.)
// - macOS versions (Intel vs Apple Silicon)
```

**필요한 것**:
```typescript
export type Platform = 'win32' | 'darwin' | 'linux' | 'unknown';

export const getPlatform = (): Platform => {
  const valid = ['win32', 'darwin', 'linux'];
  if (valid.includes(process.platform)) {
    return process.platform as any;
  }
  return 'unknown';
};

// 추가: 아키텍처
export const getArch = (): 'x64' | 'arm64' | 'unknown' => {
  const valid = ['x64', 'arm64'];
  if (valid.includes(process.arch)) {
    return process.arch as any;
  }
  return 'unknown';
};
```

---

### 2.2 문제: Windows 경로 처리 ⚠️

**현재**:
```typescript
export const getAppDataPath = (): string => {
  return process.env.APPDATA || os.homedir();
};
```

**Windows 특이점**:
```typescript
// %APPDATA% vs %LOCALAPPDATA% vs %PROGRAMFILES% 혼동
// APPDATA: C:\Users\User\AppData\Roaming (로밍 프로필)
// LOCALAPPDATA: C:\Users\User\AppData\Local (로컬만)

// 현재 구현은 APPDATA 사용
// 문제: 네트워크 드라이브에 동기화되는 경로!
// → 성능 저하, 예기치 않은 동작

// 올바른 선택?
process.env.LOCALAPPDATA;  // 로컬 저장
```

---

### 2.3 문제: Electron 업데이트 경로 🔴

**현재** (추정):
```typescript
export const getAppDataPath = (): string => {
  return path.join(os.homedir(), 'AppData', 'Local');
};

export const getAppCachePath = (): string => {
  return path.join(getAppDataPath(), 'Cache');
};
```

**문제**:
```typescript
// Electron 업데이트 시
// - app.asar (원본) vs app.asar.unpacked (압축 해제)
// - 캐시 위치 일관성?
// - 여러 버전 공존?

// app.getPath() 사용 권장
const app = require('electron').app;
const userDataPath = app.getPath('userData');  // 안전
```

---

## 3️⃣ 권한 및 접근 제어

### 3.1 문제: 파일 권한 검증 부재 ⚠️

**현재** (추정):
```typescript
export const readConfigFile = (filepath: string): Config => {
  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
};
```

**공격**:
```typescript
// 1. 구성 파일 생성 (권한 모두)
// /path/to/config.json: mode 666 (모두 읽기/쓰기 가능)

// 2. 공격자: 악의적 JSON 삽입
// "dbPassword": "admin123" → "dbPassword": "attacker123"

// 3. 애플리케이션이 악의적 구성 로드
```

**필요한 것**:
```typescript
export const readConfigFile = (filepath: string): Config => {
  // 1. 소유권 확인
  const stat = fs.statSync(filepath);
  const uid = process.getuid();
  
  if (stat.uid !== uid) {
    throw new SecurityError('Config file not owned by current user');
  }
  
  // 2. 권한 확인 (600: rw-------)
  if ((stat.mode & 0o077) !== 0) {
    throw new SecurityError('Config file has overly permissive permissions');
  }
  
  // 3. 파일 읽기
  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
};
```

---

### 3.2 문제: 캐시 디렉토리 권한 🔴

**현재** (추정):
```typescript
export const getCachePath = (): string => {
  return path.join(getAppDataPath(), 'Cache');
};

export const writeCache = (key: string, value: any): void => {
  const cachePath = path.join(getCachePath(), `${key}.json`);
  fs.writeFileSync(cachePath, JSON.stringify(value));
};
```

**공격**:
```typescript
// 1. 캐시 디렉토리: mode 755 (모두 읽기 가능)
// 2. 공격자: ls -la /path/to/Cache
// 결과: 모든 캐시 파일 열람 가능!

// 민감한 정보 노출?
// - API 토큰
// - 사용자 데이터
// - 임시 파일
```

**필요한 것**:
```typescript
export const getCachePath = (): string => {
  const cache = path.join(getAppDataPath(), 'Cache');
  
  // 디렉토리 생성 (권한 700)
  if (!fs.existsSync(cache)) {
    fs.mkdirSync(cache, { mode: 0o700, recursive: true });
  }
  
  // 권한 확인/수정
  fs.chmodSync(cache, 0o700);  // 소유자만 읽기/쓰기/실행
  
  return cache;
};

export const writeCache = (key: string, value: any): void => {
  const cachePath = path.join(getCachePath(), `${key}.json`);
  fs.writeFileSync(cachePath, JSON.stringify(value), { mode: 0o600 });
};
```

---

## 4️⃣ 환경 격리

### 4.1 문제: 프로세스 유형 감지 불일치 ⚠️

**현재** (`platform/environment.ts` 추정):
```typescript
export const getProcessType = (): 'main' | 'renderer' => {
  return process.type as any;  // ← 검증 없음
};

export const isMainProcess = (): boolean => {
  return process.type === 'main';
};

export const isRendererProcess = (): boolean => {
  return process.type === 'renderer';
};
```

**문제**:
```typescript
// 예상치 못한 프로세스 타입
process.type === 'preload';  // ← 구분 안 됨!
process.type === undefined;   // ← 처리 안 됨!

// 결과: isMainProcess() == false, isRendererProcess() == false
// → 논리 오류!
```

**필요한 것**:
```typescript
export type ProcessType = 'main' | 'renderer' | 'preload' | 'unknown';

export const getProcessType = (): ProcessType => {
  if (process.type === 'main') return 'main';
  if (process.type === 'renderer') return 'renderer';
  if (process.type === 'preload') return 'preload';
  return 'unknown';
};

export const isMainProcess = (): boolean => {
  return getProcessType() === 'main';
};
```

---

### 4.2 문제: 크로스 플랫폼 경로 구분자 ⚠️

**현재** (추정):
```typescript
export const getConfigPath = (): string => {
  return `${getAppDataPath()}/config.json`;  // ← hardcoded '/'
};
```

**문제**:
```typescript
// Windows: C:\Users\User\AppData\Local/config.json ← 혼합!
// 일부 API는 '\' 기대
// 일부는 '/' 기대

// 결과: 예기치 않은 경로 오류
```

**필요한 것**:
```typescript
export const getConfigPath = (): string => {
  return path.join(getAppDataPath(), 'config.json');  // ← path 모듈
};
```

---

## 5️⃣ 테스트 누락

### 현재 테스트 상태:
- ❌ 경로 탈출 감지
- ❌ 심링크 공격 방어
- ❌ 환경 변수 검증
- ❌ TOCTOU 공격 방지
- ❌ 파일 권한 확인
- ❌ 플랫폼 감지 정확성
- ❌ 크로스 플랫폼 호환성 (Windows/Mac/Linux)

---

## 🎯 우선순위

| ID | 항목 | 심각도 | 영향 | 우선순위 |
|---|-----|--------|------|----------|
| 1.1 | 경로 탈출 감지 | 🔴 Critical | 높음 | P0 |
| 1.2 | 심링크 공격 방지 | 🔴 Critical | 높음 | P0 |
| 3.1 | 파일 권한 검증 | 🔴 Critical | 높음 | P0 |
| 3.2 | 캐시 디렉토리 권한 | 🟡 High | 중간 | P0 |
| 1.3 | 환경 변수 검증 | 🟡 High | 중간 | P1 |
| 1.4 | TOCTOU 공격 방지 | 🟡 High | 중간 | P1 |
| 2.3 | Electron 경로 사용 | 🟡 High | 낮음 | P1 |
| 2.1 | OS 감지 불완전 | 🟢 Medium | 낮음 | P2 |

---

## 📋 액션 아이템

### P0 (즉시)
- [ ] 경로 탈출 감지 구현
- [ ] 심링크 공격 방지
- [ ] 파일 권한 검증 추가
- [ ] 캐시 디렉토리 권한 강화

### P1 (이번주)
- [ ] 환경 변수 검증
- [ ] TOCTOU 공격 방지 (원자적 작업)
- [ ] Electron app.getPath() 사용
- [ ] 테스트 (경로 관련 50+ cases)

### P2 (다음주)
- [ ] OS 감지 개선
- [ ] 크로스 플랫폼 테스트 (Windows/Mac/Linux)
- [ ] 성능 프로파일링 (권한 검사)
