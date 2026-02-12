# RayDrop

Local companion app for creating and managing Xray Cloud test cases.

---

## Quick Start (Docker — recommended)

No coding tools needed. Just install two programs, then double-click a file.

### Mac

**One-time setup:**

1. Install **Docker Desktop** — download from https://www.docker.com/products/docker-desktop, open the `.dmg`, drag Docker to Applications, and launch it once. It will ask for your password. Wait until the whale icon in the menu bar stops animating.
2. Install **Git** — download from https://git-scm.com/downloads/mac, open the installer, and follow the prompts with default settings.
3. Download `RayDrop.command` from this repository (click the file on GitHub → click the download button).
4. The first time you open it, macOS will block it. Go to **System Settings > Privacy & Security**, scroll down, and click **Open Anyway** next to the RayDrop message. Alternatively, right-click the file → Open → Open.

**Every time you want to use RayDrop:**

1. Make sure Docker Desktop is running (whale icon in menu bar).
2. Double-click `RayDrop.command`. It will pull the latest version, build the app, and open your browser to http://localhost:5173.

### Windows

**One-time setup:**

1. Install **Docker Desktop** — download from https://www.docker.com/products/docker-desktop and run the installer. Restart your computer when prompted. After restart, Docker Desktop will launch automatically — wait for it to say "Docker Desktop is running".
2. Install **Git** — download from https://git-scm.com/downloads/win and run the installer. Accept all default settings.
3. Download `RayDrop.bat` from this repository (click the file on GitHub → click the download button).
4. Windows may show "Windows protected your PC". Click **More info** → **Run anyway**.

**Every time you want to use RayDrop:**

1. Make sure Docker Desktop is running (whale icon in system tray).
2. Double-click `RayDrop.bat`. It will pull the latest version, build the app, and open your browser to http://localhost:5173.

### Stopping RayDrop

Close the terminal window that appeared when you launched the script. The app will keep running in the background.

To fully stop it, open Terminal (Mac) or Command Prompt (Windows) and run:
```
cd ~/RayDrop
docker compose down
```
On Windows use `cd %USERPROFILE%\RayDrop` instead.

---

## Developer Setup (without Docker)

### 1. Install Node.js

Download and install Node.js **v20.19+** or **v22.12+** from https://nodejs.org (LTS recommended).

Verify:

```bash
node -v
npm -v
```

### 2. Install Git

Download from https://git-scm.com/downloads and install with default settings.

### 3. Clone and install

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

Open http://localhost:5173.

---

## First Launch — Connect to Xray

On first launch you'll see the Setup page. Enter:

- **Xray Client ID** and **Client Secret** — get these from your Xray Cloud API Keys (Settings > API Keys in Xray)
- **Jira Base URL** — your Atlassian URL, e.g. `https://yourcompany.atlassian.net`

Click **Test & Save**. If credentials are valid, you're connected.

Then enter a Jira project key (e.g. `WCP`) and click Add. The project appears in the sidebar.

## Daily Use

**Docker:** double-click the launch script. Done.

**Developer:** `cd RayDrop && npm run dev`, open http://localhost:5173.

## Updating

**Docker:** the launch script pulls the latest version automatically every time you run it.

**Developer:**
```bash
cd RayDrop
git pull
npm install
npm install --prefix client
npm install --prefix server
npm run dev
```

Your test case drafts and settings are always preserved — they're stored in `config/` and `testCases/` which are gitignored (and volume-mounted in Docker).

## Backup

Copy these folders to keep your data safe:

- `config/` — credentials and settings
- `testCases/` — all your draft test cases

## Troubleshooting

**Docker Desktop won't start** — Make sure virtualization is enabled in your BIOS/UEFI settings. On Windows, also ensure WSL 2 is installed (`wsl --install` in PowerShell as admin, then restart).

**"Cannot connect to the Docker daemon"** — Docker Desktop isn't running. Open it and wait for it to fully start before double-clicking the launch script.

**Port 5173 already in use** — Another instance is running. Stop it first:
```bash
# Docker
docker compose down
# Dev mode on Mac
lsof -ti:5173 | xargs kill
# Dev mode on Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

**`Test & Save` fails with "Invalid credentials"** — Double-check your Xray Client ID and Client Secret. Make sure there are no trailing spaces.

**App loads but shows no data** — Make sure you've added at least one project in Settings and it matches a real Jira project key.

## License

MIT
