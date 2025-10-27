# Tailwind CSS 4.x + Styling 가이드

## 개요
Tailwind CSS 4.x는 최신 LTS로 CSS 변수 기반 테마 시스템을 제공합니다.
React 19 + Electron과 완벽 호환됩니다.

## 기본 설정

### tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // 브라우저 커스텀 색상
        'zen-dark': '#0f172a',
        'zen-light': '#f8fafc',
        'zen-accent': '#0ea5e9'
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace']
      },
      spacing: {
        'sidebar': '280px'
      }
    }
  },
  plugins: [
    require('tailwindcss/plugin')(({ addUtilities, theme }) => {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        }
      });
    })
  ]
};
```

### postcss.config.js
```javascript
export default {
  plugins: {
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

### globals.css
```css
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

/* CSS 변수 기반 테마 */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.6%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.6%;
    --primary: 200 100% 50%;
    --primary-foreground: 0 0% 100%;
    --secondary: 160 84% 39%;
    --secondary-foreground: 0 0% 100%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 200 100% 50%;
    --destructive: 0 84.2% 60.2%;
  }

  [data-theme='dark'] {
    --background: 0 0% 3.6%;
    --foreground: 0 0% 98%;
    --card: 0 0% 8.5%;
    --card-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
  }
}
```

## 컴포넌트 스타일링

### 예시: Button 컴포넌트
```typescript
// components/ui/button.tsx
import { ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const baseStyles = 'font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

const variantStyles = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground'
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg'
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    />
  );
}
```

### 예시: Layout 컴포넌트
```typescript
// components/layout/main-layout.tsx
import { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { StatusBar } from './status-bar';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <Header />
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-sidebar border-r border-border bg-card overflow-y-auto scrollbar-hide">
          <Sidebar />
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Status Bar */}
      <footer className="border-t border-border bg-muted text-muted-foreground text-sm">
        <StatusBar />
      </footer>
    </div>
  );
}
```

## 반응형 디자인

### 반응형 클래스
```typescript
// 모바일 첫 접근
export function ResponsiveCard() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-4">
      {/* Cards */}
    </div>
  );
}
```

### 커스텀 breakpoints
```javascript
// tailwind.config.js
theme: {
  extend: {
    screens: {
      'xs': '320px',   // 모바일
      'sm': '640px',   // 태블릿
      'md': '768px',   // 작은 데스크톱
      'lg': '1024px',  // 데스크톱
      'xl': '1280px',  // 큰 데스크톱
      '2xl': '1536px'  // 울트라와이드
    }
  }
}
```

## Electron에 최적화된 스타일

### ASCII 모드 스타일 (ascii-mode.css)
```css
/* ASCII 모드: 픽셀 크기의 정확한 레이아웃 */
.ascii-container {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.2;
  letter-spacing: 0;
  color: #00ff00;
  background-color: #000000;
}

.ascii-grid {
  display: grid;
  grid-template-columns: repeat(80, 1fr);
  grid-template-rows: repeat(24, 1fr);
  gap: 0;
  width: 960px;
  height: 576px;
}

.ascii-char {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
}
```

### 다크 모드 지원
```typescript
// hooks/useTheme.ts 대신 Zustand 스토어 사용
import { create } from 'zustand';

interface ThemeStore {
  theme: 'light' | 'dark';
  toggle: () => void;
  set: (theme: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: 'dark',
  toggle: () => set((state) => ({
    theme: state.theme === 'light' ? 'dark' : 'light'
  })),
  set: (theme) => set({ theme })
}));

// 적용
export function App() {
  const theme = useThemeStore((s) => s.theme);
  
  return (
    <div
      className="min-h-screen"
      data-theme={theme}
    >
      {/* Content */}
    </div>
  );
}
```

## 유틸리티 함수

### cn 함수 (클래스 병합)
```typescript
// lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 예시 사용
```typescript
import { cn } from '@/lib/cn';

const className = cn(
  'px-4 py-2',           // 기본
  disabled && 'opacity-50',  // 조건부
  'hover:bg-blue-100'    // 상태
);
```

## 성능 최적화

### 1. PurgeCSS 활성화
```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    // ⚠️ node_modules는 제외 (성능)
  ]
};
```

### 2. 큰 CSS 파일 분할
```javascript
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'styles': ['src/styles/globals.css']
        }
      }
    }
  }
};
```

## 호환성

- **Tailwind CSS 4.x**: 최신 LTS
- **React 19**: 완벽 호환
- **PostCSS 8.x+**: 필수
- **Node.js 20 LTS**: 호환

## 주요 패키지

```json
{
  "devDependencies": {
    "tailwindcss": "^4.0.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  }
}
```

## 추가 리소스

- [Tailwind CSS 공식 문서](https://tailwindcss.com)
- [Tailwind UI Components](https://tailwindui.com)
- [shadcn/ui](https://ui.shadcn.com) - React 컴포넌트 라이브러리
