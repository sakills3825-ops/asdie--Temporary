# Vite 빌드 도구 가이드

## 개요
Vite는 매우 빠른 빌드 도구로 HMR(Hot Module Replacement)을 지원합니다.
Electron + React + TypeScript 조합에 최적화되어 있습니다.

## 프로젝트 구조

### Monorepo 구조
```
zen-browser/
├── packages/
│   ├── main/           # Electron Main Process
│   │   ├── src/
│   │   │   ├── core/           # 핵심 기능
│   │   │   ├── managers/       # 매니저들
│   │   │   ├── services/       # 서비스들
│   │   │   ├── ipc/            # IPC 핸들러
│   │   │   ├── preload.ts      # Preload 스크립트
│   │   │   └── main.ts         # 진입점
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   │
│   ├── renderer/        # Electron Renderer Process
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── stores/
│   │   │   ├── hooks/
│   │   │   ├── types/
│   │   │   ├── lib/
│   │   │   ├── app.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   │
│   └── shared/         # 공유 코드
│       ├── src/
│       │   ├── types/
│       │   ├── constants/
│       │   └── utils/
│       ├── tsconfig.json
│       └── package.json
│
├── pnpm-workspace.yaml
├── tsconfig.json       # Root tsconfig
├── package.json
└── vite.config.shared.ts
```

## Vite 설정

### Main Process (vite.config.ts)
```typescript
// packages/main/vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      fileName: () => 'main.js',
      formats: ['cjs']
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        dir: path.resolve(__dirname, '../../dist/main')
      }
    },
    minify: false,
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### Renderer Process (vite.config.ts)
```typescript
// packages/renderer/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist/renderer'),
    emptyOutDir: true,
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  }
});
```

### Root pnpm-workspace.yaml
```yaml
packages:
  - 'packages/*'

catalogs:
  default:
    react: 19.x
    react-dom: 19.x
    typescript: 5.x
    vite: 5.x
    @vitejs/plugin-react: 4.x
```

### Root package.json
```json
{
  "name": "zen-browser",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "pnpm -r --filter=main --filter=renderer dev",
    "build": "pnpm -r build",
    "build:main": "pnpm --filter=main build",
    "build:renderer": "pnpm --filter=renderer build",
    "preview": "pnpm --filter=renderer preview",
    "type-check": "pnpm -r type-check"
  },
  "devDependencies": {
    "typescript": "5.x",
    "vite": "5.x",
    "@vitejs/plugin-react": "4.x"
  }
}
```

## TypeScript 설정

### Root tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@packages/*": ["packages/*/src"],
      "@/*": ["packages/*/src"]
    }
  },
  "include": ["packages/*/src"],
  "exclude": ["node_modules", "dist"]
}
```

### packages/main/tsconfig.json
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2020"],
    "module": "ESNext",
    "target": "ES2020"
  },
  "include": ["src"],
  "exclude": ["dist"]
}
```

### packages/renderer/tsconfig.json
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

## 개발 워크플로우

### 개발 환경 실행
```bash
# 모든 패키지 개발 모드
pnpm dev

# 개별 패키지 개발
pnpm --filter=renderer dev
pnpm --filter=main dev
```

### 빌드 프로세스
```bash
# 전체 빌드
pnpm build

# 선택적 빌드
pnpm build:main
pnpm build:renderer

# 타입 체크
pnpm type-check
```

## 성능 최적화

### 1. Dependency Pre-bundling
```typescript
export default defineConfig({
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand'
    ]
  }
});
```

### 2. 코드 분할
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@radix-ui/react-dialog']
        }
      }
    }
  }
});
```

### 3. CSS 최적화
```typescript
// vite.config.ts
export default defineConfig({
  css: {
    postcss: './postcss.config.js'
  }
});
```

## 환경 변수

### .env.development
```
VITE_API_URL=http://localhost:3000
VITE_ENV=development
```

### .env.production
```
VITE_API_URL=https://api.example.com
VITE_ENV=production
```

### 코드에서 사용
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;
```

## HMR (Hot Module Replacement)

### Main Process HMR 설정
```typescript
// packages/main/src/main.ts
if (import.meta.hot) {
  import.meta.hot.accept((module) => {
    // 핫 리로드 처리
    console.log('HMR Update');
  });
}
```

## pnpm Workspaces 명령어

```bash
# 모든 패키지에서 스크립트 실행
pnpm -r dev

# 특정 패키지만 실행
pnpm --filter=@zen/renderer build

# 워크스페이스의 파일 보기
pnpm list --depth=0

# 의존성 추가 (루트)
pnpm add -w typescript

# 의존성 추가 (패키지)
pnpm --filter=@zen/renderer add zustand

# 패키지 간 의존성 링크
pnpm --filter=@zen/renderer add -w @zen/shared
```

## 호환성

- **Vite 5.x**: 최신 LTS
- **React 19**: 완벽 호환
- **TypeScript 5.x**: 호환
- **Node.js 20 LTS**: 호환
- **pnpm 8.x+**: 권장
