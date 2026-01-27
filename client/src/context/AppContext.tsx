import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Settings, Draft, Config, NavItem } from '../types';
import { settingsApi, draftsApi, configApi } from '../services/api';

interface AppContextType {
  // Config
  config: Config | null;
  isConfigured: boolean;
  refreshConfig: () => Promise<void>;
  onReconfigure: () => void;
  showSetup: boolean;
  setShowSetup: (show: boolean) => void;

  // Settings
  settings: Settings | null;
  activeProject: string | null;
  setActiveProject: (projectKey: string) => Promise<void>;
  refreshSettings: () => Promise<void>;

  // Drafts
  drafts: Draft[];
  refreshDrafts: () => Promise<void>;

  // Navigation
  activeNav: NavItem;
  setActiveNav: (nav: NavItem) => void;

  // Loading
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeNav, setActiveNav] = useState<NavItem>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);

  const onReconfigure = useCallback(() => {
    setShowSetup(true);
  }, []);

  const refreshConfig = useCallback(async () => {
    try {
      const data = await configApi.get();
      setConfig(data);
    } catch (error) {
      console.error('Failed to load config:', error);
      setConfig({ configured: false });
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const data = await settingsApi.get();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }, []);

  const refreshDrafts = useCallback(async () => {
    try {
      const projectKey = settings?.activeProject;
      const data = await draftsApi.list(projectKey || undefined);
      setDrafts(data);
    } catch (error) {
      console.error('Failed to load drafts:', error);
    }
  }, [settings?.activeProject]);

  const setActiveProject = useCallback(async (projectKey: string) => {
    try {
      await settingsApi.setActiveProject(projectKey);
      await refreshSettings();
    } catch (error) {
      console.error('Failed to set active project:', error);
    }
  }, [refreshSettings]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([refreshConfig(), refreshSettings()]);
      setIsLoading(false);
    };
    init();
  }, [refreshConfig, refreshSettings]);

  useEffect(() => {
    if (settings?.activeProject) {
      refreshDrafts();
    }
  }, [settings?.activeProject, refreshDrafts]);

  const value: AppContextType = {
    config,
    isConfigured: config?.configured ?? false,
    refreshConfig,
    onReconfigure,
    showSetup,
    setShowSetup,
    settings,
    activeProject: settings?.activeProject ?? null,
    setActiveProject,
    refreshSettings,
    drafts,
    refreshDrafts,
    activeNav,
    setActiveNav,
    isLoading,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
