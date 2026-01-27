import { ThemeProvider } from './context/ThemeContext';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/layout';
import { Spinner } from './components/ui';
import { Dashboard } from './components/features/dashboard/Dashboard';
import { TestCasesList } from './components/features/test-cases/TestCasesList';
import { CreateTestCase } from './components/features/create/CreateTestCase';
import { SettingsPage } from './components/features/settings/SettingsPage';
import { SetupForm } from './components/features/setup';

function AppContent() {
  const { activeNav, isLoading, isConfigured, showSetup, setShowSetup, refreshConfig, config } = useApp();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  // Show SetupForm if not configured or if user requested to reconfigure
  if (!isConfigured || showSetup) {
    return (
      <SetupForm
        isEditing={isConfigured && showSetup}
        initialConfig={isConfigured ? {
          xrayClientId: '',  // We don't expose credentials
          xrayClientSecret: '',
          jiraBaseUrl: config?.jiraBaseUrl,
        } : undefined}
        onComplete={async () => {
          await refreshConfig();
          setShowSetup(false);
        }}
        onCancel={isConfigured ? () => setShowSetup(false) : undefined}
      />
    );
  }

  const renderContent = () => {
    switch (activeNav) {
      case 'dashboard':
        return <Dashboard />;
      case 'test-cases':
        return <TestCasesList />;
      case 'create':
        return <CreateTestCase />;
      case 'test-sets':
      case 'test-plans':
      case 'test-executions':
      case 'preconditions':
        return <XrayPlaceholder type={activeNav} />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  return <Layout>{renderContent()}</Layout>;
}

function XrayPlaceholder({ type }: { type: string }) {
  const titles: Record<string, string> = {
    'test-sets': 'Test Sets',
    'test-plans': 'Test Plans',
    'test-executions': 'Test Executions',
    'preconditions': 'Preconditions',
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-text-primary">{titles[type] || type}</h1>
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <p className="text-text-muted">
          View and manage {titles[type]?.toLowerCase() || type} from Xray.
        </p>
        <p className="text-sm text-text-muted mt-2">Feature coming soon...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
