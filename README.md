# Aside Browser 🌿

A minimal, distraction-free browser built with **Electron**, **React 19**, **TypeScript**, and **Tailwind CSS**.

## 🎯 Project Overview

Aside Browser is a modern desktop browser designed to minimize distractions and provide a clean, focused browsing experience. Built with cutting-edge technologies for optimal performance and developer experience.

## 🏗️ Architecture

This is a **monorepo** project using `pnpm` workspaces with three main packages:

- **`src/shared`** - Shared types, IPC channels, and utilities
- **`src/main`** - Electron Main Process (Node.js environment)
- **`src/renderer`** - React UI (Renderer Process)

### Directory Structure

```
Aside/
├── docs/                    # Reference documentation
├── src/
│   ├── shared/              # Shared types & IPC
│   ├── main/                # Electron Main Process
│   └── renderer/            # React Renderer Process
├── package.json             # Root configuration
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── postcss.config.cjs       # PostCSS configuration
├── .eslintrc.cjs            # ESLint configuration
├── .prettierrc.json         # Prettier configuration
└── pnpm-workspace.yaml      # pnpm workspace configuration
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0

### Installation

```bash
# Install dependencies
pnpm install

# Development
pnpm dev

# Build
pnpm build

# Preview
pnpm preview

# Type checking
pnpm type-check

# Linting
pnpm lint
pnpm lint:fix

# Formatting
pnpm format
pnpm format:check
```

## 📁 Workspace Structure

All configuration files are managed at the **Root level** for consistency:

- **tsconfig.json** - TypeScript strict mode configuration
- **vite.config.ts** - Vite build configuration
- **tailwind.config.js** - Tailwind CSS theme
- **postcss.config.cjs** - PostCSS plugins
- **.eslintrc.cjs** - ESLint rules
- **.prettierrc.json** - Prettier formatting rules
- **pnpm-workspace.yaml** - Workspace definition

Each workspace package has minimal **package.json** with only name and metadata.

## 🔧 Technologies

- **Electron 38 LTS** - Desktop application framework
- **React 19 LTS** - UI library
- **TypeScript 5.3** - Type safety
- **Vite 5.0** - Build tool
- **Tailwind CSS 4.0** - Utility-first CSS
- **Zustand** - State management
- **Prisma** - Database ORM (optional)

## 📚 Documentation

See `docs/` for detailed documentation:

- `01-ELECTRON-38-LTS.md` - Electron architecture & security
- `02-REACT-19-LTS.md` - React patterns & state management
- `03-VITE-BUILD-SETUP.md` - Build configuration
- `04-ARCHITECTURE-STRUCTURE.md` - Project architecture
- `05-TAILWIND-CSS-STYLING.md` - Styling system
- `06-TYPESCRIPT-SECURITY-OPTIMIZATION.md` - TypeScript & security

## 🔒 Security

- Context isolation enabled
- Sandbox enabled for renderer
- Node integration disabled
- Type-safe IPC communication
- Validated preload script

## 📦 Scripts

### Development

```bash
pnpm dev              # Run dev server with main process watcher
pnpm dev:main         # Watch main process only
pnpm dev:renderer     # Run renderer dev server only
```

### Production

```bash
pnpm build            # Build all packages
pnpm build:shared     # Build shared types
pnpm build:main       # Build main process
pnpm build:renderer   # Build renderer
pnpm preview          # Preview production build
```

### Code Quality

```bash
pnpm type-check       # Type checking
pnpm lint             # ESLint check
pnpm lint:fix         # ESLint fix
pnpm format           # Prettier format
pnpm format:check     # Prettier check
```

## 🤝 Contributing

1. Create a feature branch
2. Follow the code style (ESLint + Prettier)
3. Ensure type safety
4. Run tests before submitting PR

## 📝 License

MIT

## 👤 Author

Your Name <your.email@example.com>
