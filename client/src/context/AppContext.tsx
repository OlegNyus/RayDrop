import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Settings, Draft, Config, TestWithDetails } from '../types';
import { settingsApi, draftsApi, configApi, xrayApi } from '../services/api';

export interface ReviewCounts {
  underReview: number;
  xrayDraft: number;
}

export interface ReviewTests {
  underReview: TestWithDetails[];
  xrayDraft: TestWithDetails[];
}

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

  // Review data (shared between Sidebar and TC Review page)
  reviewCounts: ReviewCounts;
  reviewTests: ReviewTests;
  reviewTestsLoading: boolean;
  refreshReviewCounts: () => Promise<void>;

  // Loading
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [reviewCounts, setReviewCounts] = useState<ReviewCounts>({ underReview: 0, xrayDraft: 0 });
  const [reviewTests, setReviewTests] = useState<ReviewTests>({ underReview: [], xrayDraft: [] });
  const [reviewTestsLoading, setReviewTestsLoading] = useState(false);
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

  const refreshReviewCounts = useCallback(async () => {
    const projectKey = settings?.activeProject;
    const isConfigured = config?.configured ?? false;

    if (!projectKey || !isConfigured) {
      setReviewCounts({ underReview: 0, xrayDraft: 0 });
      setReviewTests({ underReview: [], xrayDraft: [] });
      return;
    }

    setReviewTestsLoading(true);
    try {
      const [underReviewData, draftData] = await Promise.all([
        xrayApi.getTestsByStatus(projectKey, 'Under Review'),
        xrayApi.getTestsByStatus(projectKey, 'Draft'),
      ]);
      setReviewTests({
        underReview: underReviewData,
        xrayDraft: draftData,
      });
      setReviewCounts({
        underReview: underReviewData.length,
        xrayDraft: draftData.length,
      });
    } catch (error) {
      console.error('Failed to load review counts:', error);
    } finally {
      setReviewTestsLoading(false);
    }
  }, [settings?.activeProject, config?.configured]);

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
      refreshReviewCounts();
    }
  }, [settings?.activeProject, refreshDrafts, refreshReviewCounts]);

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
    reviewCounts,
    reviewTests,
    reviewTestsLoading,
    refreshReviewCounts,
    isLoading,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
