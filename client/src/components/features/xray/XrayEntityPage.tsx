interface XrayEntityPageProps {
  type: 'test-sets' | 'test-plans' | 'test-executions' | 'preconditions';
}

const titles: Record<string, string> = {
  'test-sets': 'Test Sets',
  'test-plans': 'Test Plans',
  'test-executions': 'Test Executions',
  'preconditions': 'Preconditions',
};

export function XrayEntityPage({ type }: XrayEntityPageProps) {
  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-text-primary">{titles[type]}</h1>
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <p className="text-text-muted">
          View and manage {titles[type].toLowerCase()} from Xray.
        </p>
        <p className="text-sm text-text-muted mt-2">Feature coming soon...</p>
      </div>
    </div>
  );
}
