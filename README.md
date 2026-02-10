# RayDrop

Local companion app for creating and managing Xray Cloud test cases.

## Setup

### 1. Install Node.js

Download and install Node.js **v20.19+** or **v22.12+** from https://nodejs.org (LTS recommended).

Verify it's installed:

```bash
node -v
npm -v
```

Both commands should print a version number.

### 2. Install Git

Download from https://git-scm.com/downloads and install with default settings.

Verify:

```bash
git --version
```

### 3. Clone and install

Open Terminal (Mac) or Command Prompt (Windows) and run:

```bash
git clone https://github.com/OlegNyus/RayDrop.git
cd RayDrop
npm install
npm install --prefix client
npm install --prefix server
```

### 4. Start the app

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### 5. Connect to Xray

On first launch you'll see the Setup page. Enter:

- **Xray Client ID** and **Client Secret** — get these from your Xray Cloud API Keys (Settings > API Keys in Xray)
- **Jira Base URL** — your Atlassian URL, e.g. `https://yourcompany.atlassian.net`

Click **Test & Save**. If credentials are valid, you're connected.

### 6. Add a project

Enter a Jira project key (e.g. `WCP`) and click Add. The project appears in the sidebar.

## Daily use

```bash
cd RayDrop
npm run dev
```

Open http://localhost:5173. That's it.

## Updating

```bash
cd RayDrop
git pull
npm install
npm install --prefix client
npm install --prefix server
npm run dev
```

Your test case drafts and settings are preserved — they're stored in `config/` and `testCases/` which are gitignored.

## Backup

Copy these folders to keep your data safe:

- `config/` — credentials and settings
- `testCases/` — all your draft test cases

## Troubleshooting

**`node: command not found`** — Node.js isn't installed or not in your PATH. Reinstall from https://nodejs.org and restart your terminal.

**`npm install` fails with permission errors** — On Mac, try `sudo npm install`. On Windows, run Command Prompt as Administrator.

**Port 5173 already in use** — Another instance is running. Close it or kill the process:
```bash
# Mac/Linux
lsof -ti:5173 | xargs kill
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

**Port 3001 already in use** — Same as above but for port 3001 (the server).

**`Test & Save` fails with "Invalid credentials"** — Double-check your Xray Client ID and Client Secret. Make sure there are no trailing spaces.

**App loads but shows no data** — Make sure you've added at least one project in Settings and it matches a real Jira project key.

## License

MIT
