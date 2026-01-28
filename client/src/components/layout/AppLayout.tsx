import { Outlet } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Layout } from './Layout';
import { Spinner } from '../ui';
import { SetupForm } from '../features/setup';

export function AppLayout() {
  const { isLoading, isConfigured, showSetup, setShowSetup, refreshConfig, config } = useApp();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isConfigured || showSetup) {
    return (
      <SetupForm
        isEditing={isConfigured && showSetup}
        initialConfig={isConfigured ? {
          xrayClientId: '',
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

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
