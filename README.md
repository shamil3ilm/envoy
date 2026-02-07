# Envoy

A personal executive assistant desktop application for managing communications, tasks, documents, and daily workflows — all from one place. Built with Electron, React, and TypeScript.

**Private & Offline** — Envoy runs entirely on your device. There are no external connections, cloud services, or third-party servers involved. Your data never leaves your machine.

---

## Features

### Communication
- **Compose** — Create and send messages via email, WhatsApp, or Teams
- **Templates** — Reusable message templates with Jinja2 variable support
- **Snippets** — Quick-access text blocks with `#shortcut` syntax
- **Scheduled Messages** — Schedule messages for future delivery with Kanban board view
- **History** — Complete log of all sent messages

### Organization
- **Contacts** — Contact management with groups, color coding, and timeline view
- **Calendar** — Event scheduling with day/week/month views
- **Tasks** — Kanban task board with priorities, due dates, and recurring tasks
- **Reminders** — Set reminders with notifications

### Tools
- **Notes** — Quick notes editor
- **Documents** — Rich text document editor with DOCX/PDF export
- **Expenses** — Expense tracking with charts, categories, and period comparison
- **Calculator** — Built-in calculator
- **Focus Timer** — Pomodoro-style timer with session tracking
- **Automations** — If-then automation rules for workflow automation

### Productivity
- **Dashboard** — Customizable dashboard with draggable, resizable widgets
- **Command Palette** — Quick navigation and global search (`Ctrl+K`)
- **Keyboard Shortcuts** — Full keyboard shortcut support
- **Feature Selection** — Enable only the features you need; hide the rest
- **Dark Mode** — Light, dark, and system theme support
- **Collapsible Sidebar** — With custom nav groups

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Electron 28 |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS 3 |
| State | Zustand, React Context |
| Routing | React Router 6 |
| Database | SQLite (better-sqlite3) / MySQL (mysql2) |
| Template Engine | Python (Jinja2) via JSON-RPC bridge |
| Rich Text | TipTap |
| Icons | Lucide React |
| Monorepo | Turborepo + npm workspaces |

---

## Project Structure

```
envoy/
  turbo.json                  # Turborepo config
  package.json                # Root workspace
  packages/
    shared/                   # @envoy/shared — types & constants
    database-core/            # @envoy/database-core — DB interface
  apps/
    desktop/                  # Electron desktop app
      engine/                 # Python template engine (Jinja2)
      resources/              # App resources & default templates
      scripts/                # Launch scripts
      src/
        main/                 # Electron main process
          services/           # Database, email, scheduler services
          ipc-handlers.ts     # IPC request handlers
          index.ts            # Main entry point
        preload/              # Preload scripts (window.envoy API)
        renderer/             # React frontend
          components/         # Reusable components
          contexts/           # React contexts (Theme, Settings, Toast)
          hooks/              # Custom hooks
          pages/              # Page components (19 pages)
          utils/              # Utility functions
        shared/               # Shared types & IPC channel definitions
    mobile/                   # React Native app (planned)
```

---

## Installation

### Prerequisites

- **Node.js** 18 or later — [Download](https://nodejs.org/)
- **Python** 3.9 or later — [Download](https://www.python.org/) (for the template engine)
- **Git** — [Download](https://git-scm.com/)

### 1. Clone the repository

```bash
git clone https://github.com/shamil3ilm/envoy.git
cd envoy
```

### 2. Install dependencies

```bash
npm install
```

This installs all dependencies for the monorepo including the desktop app, shared packages, and rebuilds native modules (better-sqlite3) for Electron.

### 3. Set up the Python engine (optional)

The Python engine is used for Jinja2 template rendering. If you plan to use message templates:

```bash
cd apps/desktop/engine
pip install -r requirements.txt
cd ../../..
```

### 4. Configure environment (optional)

Only needed if you want to use MySQL instead of the default SQLite database:

```bash
cp .env.example .env
```

Edit `.env` with your MySQL connection details. By default, Envoy uses SQLite which requires no configuration.

### 5. Run in development mode

```bash
npm run dev:desktop
```

This starts both the Electron main process (TypeScript compiler in watch mode) and the Vite dev server for the renderer.

Then in a separate terminal, start Electron:

```bash
cd apps/desktop
npm run start
```

### 6. Build for production

Compile the app:

```bash
cd apps/desktop
npm run build
```

Package as an installer:

```bash
npm run dist
```

Output files are in `apps/desktop/release/`:

| File | Description |
|------|-------------|
| `Envoy Setup 1.0.0.exe` | Windows installer (NSIS) |
| `Envoy 1.0.0.exe` | Windows portable (no install needed) |

To build an unpacked directory instead:

```bash
npm run pack
```

---

## Database

Envoy supports two database backends:

- **SQLite** (default) — Zero configuration, stores data in a local `.db` file. Recommended for most users.
- **MySQL** — For users who prefer a full database server. Configure via `.env` file.

Database migrations run automatically on startup — no manual setup required.

---

## Privacy

- No internet connection required
- All data stored locally on your device
- No analytics, tracking, or telemetry
- No cloud sync or external API calls
- No accounts or sign-ups

---

## License

Private project by Mohamed Shamil.
