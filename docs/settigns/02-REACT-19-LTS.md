# React 19 LTS 가이드

## 개요
React 19 LTS는 최신 안정 버전으로 새로운 기능과 개선사항을 포함합니다.
2025년 기준 최신 LTS입니다.

## 핵심 원칙

### 1. 상태 관리 패턴

#### ✅ 좋은 패턴
```typescript
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  // 상태가 다른 상태에 의존 → 계산으로 처리
  const doubled = count * 2; // useState 불필요
  
  return (
    <div>
      <p>Count: {count}, Doubled: {doubled}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
```

#### ❌ 나쁜 패턴
```typescript
// 과도한 useState 사용
function Counter() {
  const [count, setCount] = useState(0);
  const [doubled, setDoubled] = useState(0); // ❌ 불필요!
  
  useEffect(() => {
    setDoubled(count * 2); // ❌ 이렇게 하면 안 됨
  }, [count]);
}
```

### 2. useEffect 피하기

#### 대안: 함수로 로직 이동
```typescript
// ❌ useEffect 사용
function Component() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetchData().then(setData);
  }, []);
}

// ✅ 이벤트 핸들러에서 직접 호출
function Component() {
  const handleClick = async () => {
    const data = await fetchData();
    setData(data);
  };
}
```

### 3. useCallback 피하기

```typescript
// ❌ useCallback 사용
const memoizedCallback = useCallback(() => {
  doSomething();
}, [dep1, dep2]);

// ✅ 필요한 경우 함수를 컴포넌트 밖으로
const callback = () => {
  doSomething();
};

function Component() {
  return <button onClick={callback}>Click</button>;
}
```

## React 19의 새로운 기능

### 1. useActionState Hook
```typescript
import { useActionState } from 'react';

function Form() {
  async function submitAction(prevState, formData) {
    const result = await api.submit(formData);
    return { success: result.ok, message: result.message };
  }

  const [state, action, isPending] = useActionState(
    submitAction,
    { success: false, message: '' }
  );

  return (
    <form action={action}>
      <input name="email" type="email" required />
      <button disabled={isPending}>
        {isPending ? 'Submitting...' : 'Submit'}
      </button>
      {state.message && <p>{state.message}</p>}
    </form>
  );
}
```

### 2. useOptimistic Hook
```typescript
import { useOptimistic } from 'react';

function TodoList({ todos, addTodo }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (currentTodos, newTodo) => [
      ...currentTodos,
      { id: 'temp', text: newTodo, pending: true }
    ]
  );

  const handleAdd = async (text) => {
    addOptimisticTodo(text);
    await api.addTodo(text);
  };

  return (
    <div>
      {optimisticTodos.map(todo => (
        <div key={todo.id} className={todo.pending ? 'opacity-50' : ''}>
          {todo.text}
        </div>
      ))}
    </div>
  );
}
```

### 3. 리소스 힌트
```typescript
import { 
  prefetchDNS, 
  preconnect, 
  preload, 
  preinit 
} from 'react-dom';

function App() {
  // DNS 프리페치
  prefetchDNS('https://cdn.example.com');
  
  // 미리 연결
  preconnect('https://api.example.com');
  
  // 리소스 사전 로드
  preload('https://cdn.example.com/font.woff', { as: 'font' });
  preload('https://cdn.example.com/style.css', { as: 'style' });
  
  // 스크립트 즉시 로드 및 실행
  preinit('https://cdn.example.com/script.js', { as: 'script' });

  return <div>App Content</div>;
}
```

## 상태 관리 권장사항

### Zustand (권장)
```typescript
import { create } from 'zustand';

interface AppState {
  count: number;
  increment: () => void;
  decrement: () => void;
}

export const useStore = create<AppState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 }))
}));

function Counter() {
  const { count, increment, decrement } = useStore();
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}
```

### Context API (소규모 상태)
```typescript
import { createContext, useContext, useState } from 'react';

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const value: ThemeContextType = {
    theme,
    toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light')
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

## 컴포넌트 구조

### 파일 구조
```
src/
├── components/
│   ├── ui/              # shadcn 컴포넌트
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   └── ...
│   ├── features/
│   │   ├── browser/
│   │   ├── settings/
│   │   └── ...
│   └── common/
│       └── ...
├── hooks/               # 커스텀 훅 금지 (함수 사용)
├── lib/                 # 유틸 함수
├── stores/              # Zustand 스토어
├── pages/               # 라우트 페이지
└── types/               # TypeScript 타입
```

## 성능 최적화

### ✅ 권장사항
1. 상태를 사용하는 가장 하위 컴포넌트 근처에 배치
2. Props drilling 대신 Context나 Zustand 사용
3. 큰 목록은 React Query 또는 SWR로 가상화
4. 동적 임포트로 코드 분할

```typescript
// 동적 임포트 (코드 분할)
const SettingsPanel = lazy(() => import('./SettingsPanel'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettingsPanel />
    </Suspense>
  );
}
```

## Type Safety

### TypeScript 엄격 모드
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitThis": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 컴포넌트 타입 정의
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  children
}) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

## 호환성 정보

- **React 19**: 최신 LTS
- **TypeScript 5.x**: 완벽 호환
- **Vite**: 빠른 번들링
- **Node.js 20 LTS**: 호환
