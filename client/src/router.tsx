import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './components/features/dashboard/Dashboard';
import { TestCasesList } from './components/features/test-cases/TestCasesList';
import { CreateTestCase } from './components/features/create/CreateTestCase';
import { EditTestCase } from './components/features/create/EditTestCase';
import { SettingsPage } from './components/features/settings/SettingsPage';
import { XrayEntityPage } from './components/features/xray/XrayEntityPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'test-cases', element: <TestCasesList /> },
      { path: 'test-cases/new', element: <CreateTestCase /> },
      { path: 'test-cases/:id/edit', element: <EditTestCase /> },
      { path: 'test-sets', element: <XrayEntityPage type="test-sets" /> },
      { path: 'test-plans', element: <XrayEntityPage type="test-plans" /> },
      { path: 'test-executions', element: <XrayEntityPage type="test-executions" /> },
      { path: 'preconditions', element: <XrayEntityPage type="preconditions" /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);
