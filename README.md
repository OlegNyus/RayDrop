# RayDrop

A desktop companion app for Xray Cloud that makes creating and managing test cases faster and easier.

## What is RayDrop?

RayDrop is a local web application that connects to your Jira/Xray Cloud instance and provides a streamlined interface for:

- **Creating Test Cases** - Write test cases with a guided workflow (Basic Info → Test Steps → Xray Linking)
- **Managing Drafts** - Save work locally, review and edit before importing to Xray
- **Bulk Import** - Import multiple test cases to Xray at once
- **Browsing Xray Entities** - View Test Sets, Test Plans, Test Executions, and Preconditions
- **TC Review** - See all tests with "Under Review" status in one place

## Why RayDrop?

- **Works Offline** - Draft test cases locally without constant Jira connection
- **Faster Workflow** - Streamlined UI focused on test case creation
- **Bulk Operations** - Select multiple test cases and import them all at once
- **Code Snippets** - Add JSON/JS/TS code to test data fields with syntax highlighting
- **Multi-Project** - Switch between Jira projects easily

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm
- Xray Cloud credentials (Client ID and Client Secret)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/RayDrop.git
cd RayDrop

# Install all dependencies
npm install
npm install --prefix client
npm install --prefix server
```

### Running the App

```bash
# Start both client and server
npm run dev
```

Open http://localhost:5173 in your browser.

### First-Time Setup

1. **Connect to Xray** - Enter your Xray Cloud API credentials:
   - Client ID
   - Client Secret
   - Jira Base URL (e.g., `https://yourcompany.atlassian.net`)

2. **Add a Project** - Enter a Jira project key (e.g., `WCP`) to start working

3. **Create Test Cases** - Navigate to "Create Test Case" and start writing

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   RayDrop   │────▶│   Express   │────▶│  Xray Cloud │
│   (React)   │◀────│   Server    │◀────│     API     │
└─────────────┘     └─────────────┘     └─────────────┘
        │                  │
        │                  ▼
        │           ┌─────────────┐
        └──────────▶│ Local Files │
                    │ (JSON)      │
                    └─────────────┘
```

- **Client** (React) - The UI you interact with at http://localhost:5173
- **Server** (Express) - Handles API calls to Xray and stores data locally
- **Local Storage** - Test case drafts and settings saved as JSON files

### Data Storage

All your data is stored locally in the project folder:

| Data | Location | Contents |
|------|----------|----------|
| Credentials | `config/xray-config.json` | Xray API credentials |
| Settings | `config/settings.json` | Projects, preferences |
| Test Cases | `testCases/` | Draft test cases organized by project |

**Note:** These folders are gitignored. Your data won't be lost when pulling updates.

## Test Case Workflow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐
│   New   │───▶│  Draft  │───▶│  Ready  │───▶│ Imported │
└─────────┘    └─────────┘    └─────────┘    └──────────┘
     │              │              │               │
     │         Save work      Complete &      Exists in
   Start         locally      validated         Xray
```

1. **New** - Just created, not yet saved
2. **Draft** - Work in progress, saved locally
3. **Ready** - Complete with all required fields, can be imported
4. **Imported** - Successfully created in Xray

## Features

### Test Case Creation

- Summary builder with Functional Area + Layer + Title
- Multi-step test steps with drag-and-drop reordering
- Code snippet support in test data fields (JSON, JS, TS)
- Labels and priority selection

### Xray Linking

- Link to Test Plans, Test Sets, Test Executions
- Add Preconditions
- Assign to Xray folders

### Bulk Operations

- Select multiple test cases
- Mark as Ready (validates required fields)
- Import to Xray in bulk

### Browse Xray Entities

- View Test Sets, Test Plans, Test Executions, Preconditions
- See test counts and execution status
- Navigate to detailed views

## Tech Stack

- **Client**: React 19 + Vite + TypeScript + Tailwind CSS
- **Server**: Express + TypeScript
- **Testing**: Vitest + React Testing Library + Playwright

## Development

### Running in Development

```bash
# Run both client and server with hot reload
npm run dev

# Or run separately
npm run dev:client  # http://localhost:5173
npm run dev:server  # http://localhost:3001
```

### Building for Production

```bash
npm run build
```

### Running Tests

```bash
# Unit/Integration tests
npm test

# E2E tests
npm run test:e2e

# All tests
npm run test:all
```

## Project Structure

```
RayDrop/
├── client/                 # React frontend
│   └── src/
│       ├── components/     # UI components
│       ├── context/        # React contexts
│       ├── services/       # API client
│       └── types/          # TypeScript types
├── server/                 # Express backend
│   └── src/
│       ├── routes/         # API endpoints
│       └── utils/          # Xray client, file operations
├── tests/                  # Unit/Integration tests
├── e2e/                    # E2E tests (Playwright)
├── config/                 # Runtime config (gitignored)
└── testCases/              # Test case drafts (gitignored)
```

## Backup & Data Safety

Your local data is safe during normal git operations (`pull`, `merge`, `checkout`).

**To backup your data**, copy these folders:
- `config/` - Your credentials and settings
- `testCases/` - All your test case drafts

**Caution:** Running `git clean -fd` will delete these folders!

## License

MIT
