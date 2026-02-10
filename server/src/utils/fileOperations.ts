import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { Config, Settings, ProjectSettings, Draft } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

export const CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'xray-config.json');
export const SETTINGS_PATH = path.join(PROJECT_ROOT, 'config', 'settings.json');
export const DRAFTS_DIR = path.join(PROJECT_ROOT, 'testCases');

// ============ Utility Functions ============

export function slugify(str: string): string {
  if (!str) return 'untitled';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'untitled';
}

export function sanitizeFolderName(str: string): string {
  if (!str) return 'General';
  return str
    .trim()
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    || 'General';
}

export function parseSummary(summary: string): { area: string; title: string } {
  if (!summary) {
    return { area: 'General', title: 'untitled' };
  }

  const parts = summary.split('|').map(p => p.trim());

  if (parts.length >= 3) {
    return { area: parts[0], title: parts[2] };
  } else if (parts.length === 2) {
    return { area: parts[0], title: parts[1] };
  } else {
    return { area: 'General', title: summary };
  }
}

// ============ Config Functions ============

export function configExists(): boolean {
  return fs.existsSync(CONFIG_PATH);
}

export function readConfig(): Config | null {
  if (!configExists()) {
    return null;
  }
  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(content) as Config;
  } catch (error) {
    console.error('Error reading config:', error);
    return null;
  }
}

export function writeConfig(config: Config): string {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  return CONFIG_PATH;
}

// ============ Settings Functions ============

const DEFAULT_SETTINGS: Settings = {
  projects: [],
  hiddenProjects: [],
  activeProject: null,
  projectSettings: {},
};

export function readSettings(): Settings {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const content = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const settings = JSON.parse(content) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (error) {
    console.error('Error reading settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings: Settings): string {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  return SETTINGS_PATH;
}

export function syncSettingsWithFileSystem(): boolean {
  const settings = readSettings();
  let modified = false;

  if (!fs.existsSync(DRAFTS_DIR)) {
    fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  }

  const existingFolders = fs.readdirSync(DRAFTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const validProjects = settings.projects.filter(p => existingFolders.includes(p));
  if (validProjects.length !== settings.projects.length) {
    const removedProjects = settings.projects.filter(p => !existingFolders.includes(p));
    console.log('Removing stale projects from settings:', removedProjects);
    settings.projects = validProjects;
    modified = true;

    for (const removed of removedProjects) {
      delete settings.projectSettings[removed];
    }
  }

  const validHidden = settings.hiddenProjects.filter(p => existingFolders.includes(p));
  if (validHidden.length !== settings.hiddenProjects.length) {
    settings.hiddenProjects = validHidden;
    modified = true;
  }

  if (settings.activeProject && !validProjects.includes(settings.activeProject)) {
    const visibleProjects = validProjects.filter(p => !settings.hiddenProjects.includes(p));
    settings.activeProject = visibleProjects[0] || null;
    modified = true;
  }

  if (modified) {
    writeSettings(settings);
  }

  return modified;
}

export function getSettingsSynced(): Settings {
  syncSettingsWithFileSystem();
  return readSettings();
}

export function getProjectSettings(projectKey: string): ProjectSettings {
  const settings = readSettings();
  return settings.projectSettings?.[projectKey] || {
    functionalAreas: [],
    labels: [],
    collections: [],
    color: '',
    reusablePrefix: 'REUSE',
  };
}

export function saveProjectSettings(projectKey: string, projectSettings: ProjectSettings): void {
  const settings = readSettings();
  if (!settings.projectSettings) {
    settings.projectSettings = {};
  }
  settings.projectSettings[projectKey] = projectSettings;
  writeSettings(settings);
}

// ============ Project Management ============

export const PASTEL_COLORS = [
  '#a5c7e9', '#a8e6cf', '#c9b8e8', '#ffd3b6',
  '#ffb6c1', '#f5b5b5', '#f9e9a1', '#a8e0e0',
];

export function addProject(projectKey: string, color?: string): { success: boolean; alreadyExists?: boolean } {
  const settings = readSettings();

  if (settings.projects.includes(projectKey)) {
    settings.hiddenProjects = settings.hiddenProjects.filter(p => p !== projectKey);
    writeSettings(settings);
    return { success: true, alreadyExists: true };
  }

  settings.projects.push(projectKey);

  const assignedColor = color || PASTEL_COLORS[(settings.projects.length - 1) % PASTEL_COLORS.length];

  if (!settings.projectSettings) {
    settings.projectSettings = {};
  }
  settings.projectSettings[projectKey] = {
    functionalAreas: [],
    labels: [],
    collections: [],
    color: assignedColor,
    reusablePrefix: 'REUSE',
  };

  if (!settings.activeProject) {
    settings.activeProject = projectKey;
  }

  writeSettings(settings);

  const projectDir = path.join(DRAFTS_DIR, projectKey);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  return { success: true };
}

export function hideProject(projectKey: string): { success: boolean } {
  const settings = readSettings();

  if (!settings.hiddenProjects.includes(projectKey)) {
    settings.hiddenProjects.push(projectKey);
  }

  if (settings.activeProject === projectKey) {
    const visibleProjects = settings.projects.filter(
      p => !settings.hiddenProjects.includes(p)
    );
    settings.activeProject = visibleProjects[0] || null;
  }

  writeSettings(settings);
  return { success: true };
}

export function unhideProject(projectKey: string): { success: boolean } {
  const settings = readSettings();
  settings.hiddenProjects = settings.hiddenProjects.filter(p => p !== projectKey);
  writeSettings(settings);
  return { success: true };
}

export function setActiveProject(projectKey: string): { success: boolean; error?: string } {
  const settings = readSettings();

  if (!settings.projects.includes(projectKey)) {
    return { success: false, error: 'Project not found' };
  }

  settings.activeProject = projectKey;
  writeSettings(settings);
  return { success: true };
}

export function removeProject(projectKey: string): { success: boolean } {
  const settings = readSettings();

  // Remove from projects list
  settings.projects = settings.projects.filter(p => p !== projectKey);

  // Remove from hidden projects
  settings.hiddenProjects = settings.hiddenProjects.filter(p => p !== projectKey);

  // Remove project settings
  delete settings.projectSettings[projectKey];

  // Update active project if needed
  if (settings.activeProject === projectKey) {
    const visibleProjects = settings.projects.filter(
      p => !settings.hiddenProjects.includes(p)
    );
    settings.activeProject = visibleProjects[0] || null;
  }

  writeSettings(settings);
  return { success: true };
}

// ============ Draft Functions ============

export function getDraftPath(projectKey: string, area: string, title: string, id: string): string {
  const sanitizedArea = sanitizeFolderName(area);
  const slugifiedTitle = slugify(title);
  const shortId = id ? id.substring(0, 8) : '';
  const filename = shortId ? `${slugifiedTitle}-${shortId}.json` : `${slugifiedTitle}.json`;
  return path.join(DRAFTS_DIR, projectKey, sanitizedArea, filename);
}

function ensureDraftDir(projectKey: string, area: string): string {
  const sanitizedArea = sanitizeFolderName(area);
  const dir = path.join(DRAFTS_DIR, projectKey, sanitizedArea);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function findDraftById(id: string): { draft: Draft; filePath: string } | null {
  if (!fs.existsSync(DRAFTS_DIR)) {
    return null;
  }

  const projects = fs.readdirSync(DRAFTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const project of projects) {
    const projectDir = path.join(DRAFTS_DIR, project);
    const areas = fs.readdirSync(projectDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const area of areas) {
      const areaDir = path.join(projectDir, area);
      const files = fs.readdirSync(areaDir).filter(f => f.endsWith('.json'));

      for (const file of files) {
        if (file.includes(id.substring(0, 8))) {
          const filePath = path.join(areaDir, file);
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const draft = JSON.parse(content) as Draft;
            if (draft.id === id) {
              return { draft, filePath };
            }
          } catch {
            // Skip invalid files
          }
        }
      }
    }
  }

  return null;
}

export function listDrafts(projectKey: string | null = null): Draft[] {
  if (!fs.existsSync(DRAFTS_DIR)) {
    fs.mkdirSync(DRAFTS_DIR, { recursive: true });
    return [];
  }

  const drafts: Draft[] = [];

  let projects: string[];
  if (projectKey) {
    projects = [projectKey];
  } else {
    projects = fs.readdirSync(DRAFTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  }

  for (const project of projects) {
    const projectDir = path.join(DRAFTS_DIR, project);
    if (!fs.existsSync(projectDir)) continue;

    const areas = fs.readdirSync(projectDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const area of areas) {
      const areaDir = path.join(projectDir, area);
      const files = fs.readdirSync(areaDir).filter(f => f.endsWith('.json'));

      for (const file of files) {
        try {
          const filePath = path.join(areaDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const draft = JSON.parse(content) as Draft;
          drafts.push(draft);
        } catch (err) {
          console.error(`Error reading draft file ${file}:`, err);
        }
      }
    }
  }

  return drafts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function readDraft(id: string): Draft | null {
  const result = findDraftById(id);
  return result ? result.draft : null;
}

function cleanEmptyDirs(dir: string): void {
  if (!dir.startsWith(DRAFTS_DIR) || dir === DRAFTS_DIR) {
    return;
  }

  try {
    const files = fs.readdirSync(dir);
    if (files.length === 0) {
      fs.rmdirSync(dir);
      cleanEmptyDirs(path.dirname(dir));
    }
  } catch {
    // Directory might not exist or not be empty
  }
}

export function writeDraft(id: string, draft: Draft): string {
  const { area, title } = parseSummary(draft.summary);
  const projectKey = draft.projectKey || 'Default';

  ensureDraftDir(projectKey, area);

  const existing = findDraftById(id);
  if (existing) {
    const newPath = getDraftPath(projectKey, area, title, id);
    if (existing.filePath !== newPath) {
      fs.unlinkSync(existing.filePath);
      cleanEmptyDirs(path.dirname(existing.filePath));
    }
  }

  const filePath = getDraftPath(projectKey, area, title, id);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(draft, null, 2));
  return filePath;
}

export function deleteDraft(id: string): boolean {
  const result = findDraftById(id);
  if (!result) {
    return false;
  }

  try {
    fs.unlinkSync(result.filePath);
    cleanEmptyDirs(path.dirname(result.filePath));
    return true;
  } catch (error) {
    console.error(`Error deleting draft ${id}:`, error);
    return false;
  }
}

export function deleteAllDrafts(): void {
  if (!fs.existsSync(DRAFTS_DIR)) {
    return;
  }

  fs.rmSync(DRAFTS_DIR, { recursive: true, force: true });
  fs.mkdirSync(DRAFTS_DIR, { recursive: true });
}
