# Peep

AI desktop IDE for Flutter developers.

## Requirements

- Node.js 20+
- pnpm 9+
- Flutter SDK (optional for preview features)

## Development

```bash
pnpm install
pnpm dev
```

## Current features (MVP scaffold)

- 4-panel layout: Explorer | Editor + Preview | AI Chat | Output
- **Monaco Editor** with Dart/YAML/JSON syntax, Ctrl+S save
- **Ctrl+P** quick file search
- Open Flutter project, file tree, read/write files
- **Flutter Web preview** (auto-starts on project open, port 5174)
- **`flutter analyze`** diagnostics in Problems panel
- File watcher: re-analyze + hot reload on save
- **AI agent** with OpenAI (BYOK): read/search tools + file edit proposals
- **Diff viewer**: accept/reject proposed changes before applying
- AI chat panel with streaming status
- **Git panel**: status, stage/unstage, commit, diff view
- **Terminal**: xterm.js shell in project directory
- Allowlisted `runCommand` for safe flutter/git commands
- **New Project** wizard: 3 templates or AI prompt scaffolding
- Local JSON store for recent projects

## Project structure

- `apps/desktop` — Electron app (main, preload, renderer)
- `packages/shared` — IPC types and shared contracts
- `packages/platform-core` — Platform adapter registry
- `packages/agent` — AI agent core (stub)
- `packages/flutter-adapter` — Flutter-specific logic
- `docs/PRODUCT_PLAN.md` — Full product and architecture plan
