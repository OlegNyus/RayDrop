import { useState, useEffect } from 'react';
import { Button } from '../../ui';

interface FeatureDemoProps {
  onClose: () => void;
}

// Animation keyframes as style tag
const AnimationStyles = () => (
  <style>{`
    @keyframes typewriter {
      from { width: 0; }
      to { width: 100%; }
    }
    @keyframes blink {
      50% { border-color: transparent; }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes progressFill {
      from { width: 0%; }
      to { width: 100%; }
    }
    @keyframes checkmarkDraw {
      from { stroke-dashoffset: 24; }
      to { stroke-dashoffset: 0; }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
    @keyframes expandWidth {
      from { width: 0; opacity: 0; }
      to { width: 100%; opacity: 1; }
    }
    @keyframes dropdownOpen {
      from { opacity: 0; transform: scaleY(0); }
      to { opacity: 1; transform: scaleY(1); }
    }
    .animate-fadeInUp { animation: fadeInUp 0.5s ease-out forwards; }
    .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
    .animate-slideInRight { animation: slideInRight 0.4s ease-out forwards; }
    .animate-slideInLeft { animation: slideInLeft 0.4s ease-out forwards; }
    .animate-scaleIn { animation: scaleIn 0.3s ease-out forwards; }
    .animate-pulse { animation: pulse 2s ease-in-out infinite; }
    .animate-bounce { animation: bounce 1s ease-in-out infinite; }
  `}</style>
);

// Feature 1: Create Test Cases - Animated workflow
function CreateTestCaseDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(s => (s + 1) % 8);
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-background rounded-lg border border-border p-4 w-full max-w-lg h-[250px]">
      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-4 px-2">
        {['Basic Info', 'Test Steps', 'Linking'].map((label, i) => (
          <div key={label} className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              step >= i * 2 + 2 ? 'bg-success text-white' :
              step >= i * 2 ? 'bg-accent text-white' : 'bg-sidebar text-text-muted'
            }`}>
              {step >= i * 2 + 2 ? '✓' : i + 1}
            </div>
            <span className="text-[10px] text-text-muted mt-1">{label}</span>
          </div>
        ))}
      </div>

      {/* Animated Content */}
      <div className="space-y-2 h-[150px]">
        {step >= 0 && step < 2 && (
          <div className="space-y-2 animate-fadeIn">
            <div className="h-8 bg-sidebar rounded flex items-center px-2 overflow-hidden">
              <span className="text-xs text-text-muted mr-2">Summary:</span>
              <span
                className="text-xs text-text-primary overflow-hidden whitespace-nowrap"
                style={{
                  animation: step >= 1 ? 'typewriter 0.8s steps(20) forwards' : 'none',
                  width: step >= 1 ? 'auto' : '0'
                }}
              >
                Auth | Login | Verify user login
              </span>
            </div>
            <div className="h-16 bg-sidebar rounded flex items-start p-2">
              <span className="text-xs text-text-muted mr-2">Desc:</span>
              {step >= 1 && (
                <span className="text-xs text-text-primary animate-fadeIn">
                  Test that users can log in with valid credentials...
                </span>
              )}
            </div>
          </div>
        )}

        {step >= 2 && step < 4 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 bg-sidebar rounded animate-slideInRight">
              <span className="w-5 h-5 rounded bg-accent/20 text-accent text-xs flex items-center justify-center">1</span>
              <span className="text-xs text-text-primary">Enter username and password</span>
            </div>
            {step >= 3 && (
              <div className="flex items-center gap-2 p-2 bg-sidebar rounded animate-slideInRight" style={{ animationDelay: '0.1s' }}>
                <span className="w-5 h-5 rounded bg-accent/20 text-accent text-xs flex items-center justify-center">2</span>
                <span className="text-xs text-text-primary">Click Login button</span>
              </div>
            )}
            {step >= 3 && (
              <div className="flex items-center gap-2 p-2 bg-sidebar rounded animate-slideInRight" style={{ animationDelay: '0.2s' }}>
                <span className="w-5 h-5 rounded bg-accent/20 text-accent text-xs flex items-center justify-center">3</span>
                <span className="text-xs text-text-primary">Verify dashboard appears</span>
              </div>
            )}
          </div>
        )}

        {step >= 4 && step < 6 && (
          <div className="space-y-2">
            <div className="p-2 bg-sidebar rounded animate-fadeIn">
              <span className="text-[10px] text-text-muted">Test Plan</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-text-primary">Sprint 1 Plan</span>
                <span className="text-success text-xs">✓</span>
              </div>
            </div>
            {step >= 5 && (
              <div className="p-2 bg-sidebar rounded animate-fadeIn">
                <span className="text-[10px] text-text-muted">Folder</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-text-primary">/Auth/Login</span>
                  <span className="text-success text-xs">✓</span>
                </div>
              </div>
            )}
          </div>
        )}

        {step >= 6 && (
          <div className="flex flex-col items-center justify-center py-4 animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ strokeDasharray: 24, animation: 'checkmarkDraw 0.4s ease-out forwards' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm font-medium text-success">TEST-123 Created!</span>
            <span className="text-xs text-text-muted">Linked to Sprint 1 Plan</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Feature 2: Smart Xray Linking Demo
function XrayLinkingDemo() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase(p => (p + 1) % 6);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const entities = [
    { type: 'Test Plan', items: ['Sprint 1 Plan', 'Sprint 2 Plan', 'Regression'] },
    { type: 'Test Execution', items: ['Daily Run', 'Nightly Build'] },
    { type: 'Test Set', items: ['Login Tests', 'API Tests'] },
    { type: 'Folder', items: ['/Auth', '/Auth/Login', '/API'] },
  ];

  return (
    <div className="bg-background rounded-lg border border-border p-4 w-full max-w-lg h-[250px] overflow-hidden">
      <div className="grid grid-cols-2 gap-3">
        {entities.map((entity, idx) => (
          <div key={entity.type} className="relative">
            <div className={`p-2 rounded border transition-all duration-300 ${
              phase === idx + 1 ? 'border-accent bg-accent/5' : 'border-border bg-sidebar'
            }`}>
              <span className="text-[10px] text-text-muted block mb-1">{entity.type}</span>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-primary truncate">
                  {phase > idx ? entity.items[0] : 'Select...'}
                </span>
                <svg className={`w-3 h-3 text-text-muted transition-transform ${phase === idx + 1 ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Dropdown animation */}
            {phase === idx + 1 && (
              <div
                className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-lg z-10 overflow-hidden"
                style={{ animation: 'dropdownOpen 0.2s ease-out forwards', transformOrigin: 'top' }}
              >
                {entity.items.map((item, i) => (
                  <div
                    key={item}
                    className={`px-2 py-1.5 text-xs ${i === 0 ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-sidebar'}`}
                  >
                    {item}
                  </div>
                ))}
              </div>
            )}

            {/* Selected checkmark */}
            {phase > idx + 1 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center animate-scaleIn">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {phase >= 5 && (
        <div className="mt-3 p-2 bg-success/10 border border-success/30 rounded text-center animate-fadeIn">
          <span className="text-xs text-success font-medium">4 entities linked!</span>
        </div>
      )}
    </div>
  );
}

// Feature 3: One-Click Import Demo
function ImportDemo() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase(p => (p + 1) % 8);
    }, 800);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    { label: 'Creating test in Jira...', done: phase >= 2 },
    { label: 'Linking to Test Plan...', done: phase >= 3 },
    { label: 'Linking to Test Execution...', done: phase >= 4 },
    { label: 'Adding to folder...', done: phase >= 5 },
  ];

  return (
    <div className="bg-background rounded-lg border border-border p-4 w-full max-w-lg h-[250px]">
      {phase < 6 ? (
        <>
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>Importing...</span>
              <span>{Math.min(phase * 20, 100)}%</span>
            </div>
            <div className="h-2 bg-sidebar rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-500 ease-out rounded-full"
                style={{ width: `${Math.min(phase * 20, 100)}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {steps.map((step, i) => (
              phase >= i + 1 && (
                <div key={i} className="flex items-center gap-2 animate-fadeIn">
                  {step.done ? (
                    <div className="w-4 h-4 rounded-full bg-success flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  )}
                  <span className={`text-xs ${step.done ? 'text-text-muted' : 'text-text-primary'}`}>
                    {step.label}
                  </span>
                </div>
              )
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center py-4 animate-scaleIn">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mb-3">
            <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-lg font-semibold text-text-primary">Import Complete!</span>
          <span className="text-sm text-text-muted mt-1">TEST-456 created in Jira</span>
          <div className="flex gap-2 mt-3">
            <span className="px-2 py-1 bg-accent/10 text-accent text-xs rounded">Sprint 1 Plan</span>
            <span className="px-2 py-1 bg-accent/10 text-accent text-xs rounded">/Auth/Login</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Feature 4: Dashboard Demo
function DashboardDemo() {
  const [filter, setFilter] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFilter(f => (f + 1) % 4);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const filters = ['All', 'Draft', 'Ready', 'Imported'];
  const cards = [
    { title: 'Login validation test', status: 'draft', key: null },
    { title: 'API auth flow', status: 'ready', key: null },
    { title: 'Session timeout', status: 'imported', key: 'TEST-789' },
  ];

  const filteredCards = filter === 0 ? cards : cards.filter(c => c.status === filters[filter].toLowerCase());

  return (
    <div className="bg-background rounded-lg border border-border p-4 w-full max-w-lg h-[250px]">
      {/* Filter tabs */}
      <div className="flex gap-1 mb-3 p-1 bg-sidebar rounded-lg">
        {filters.map((f, i) => (
          <button
            key={f}
            className={`flex-1 px-2 py-1 text-xs rounded transition-all ${
              filter === i ? 'bg-card text-text-primary shadow-sm' : 'text-text-muted'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-sidebar rounded mb-3">
        <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="text-xs text-text-muted">Search test cases...</span>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {filteredCards.map((card, i) => (
          <div
            key={i}
            className="p-2 bg-sidebar rounded flex items-center justify-between animate-fadeIn"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="flex-1 min-w-0">
              <span className="text-xs text-text-primary block truncate">{card.title}</span>
              {card.key && <span className="text-[10px] text-accent">{card.key}</span>}
            </div>
            <span className={`px-1.5 py-0.5 text-[10px] rounded ${
              card.status === 'draft' ? 'bg-amber-500/20 text-amber-500' :
              card.status === 'ready' ? 'bg-blue-500/20 text-blue-500' :
              'bg-success/20 text-success'
            }`}>
              {card.status}
            </span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="flex justify-around mt-3 pt-3 border-t border-border">
        <div className="text-center">
          <span className="text-lg font-bold text-text-primary">12</span>
          <span className="text-[10px] text-text-muted block">Drafts</span>
        </div>
        <div className="text-center">
          <span className="text-lg font-bold text-text-primary">5</span>
          <span className="text-[10px] text-text-muted block">Ready</span>
        </div>
        <div className="text-center">
          <span className="text-lg font-bold text-success">28</span>
          <span className="text-[10px] text-text-muted block">Imported</span>
        </div>
      </div>
    </div>
  );
}

// Feature 5: TC Review Demo
function TCReviewDemo() {
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSelected(s => {
        if (s.length >= 3) return [];
        return [...s, s.length];
      });
    }, 800);
    return () => clearInterval(timer);
  }, []);

  const tests = [
    { key: 'TEST-101', title: 'Checkout flow validation', status: 'Under Review' },
    { key: 'TEST-102', title: 'Payment processing', status: 'Under Review' },
    { key: 'TEST-103', title: 'Order confirmation', status: 'Draft' },
  ];

  return (
    <div className="bg-background rounded-lg border border-border p-4 w-full max-w-lg h-[250px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-primary">Tests Under Review</span>
          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-[10px] rounded">3</span>
        </div>
        {selected.length > 0 && (
          <span className="text-[10px] text-accent animate-fadeIn">{selected.length} selected</span>
        )}
      </div>

      {/* Test list */}
      <div className="space-y-2">
        {tests.map((test, i) => (
          <div
            key={test.key}
            className={`p-2 rounded border transition-all ${
              selected.includes(i) ? 'border-accent bg-accent/5' : 'border-border bg-sidebar'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                selected.includes(i) ? 'border-accent bg-accent' : 'border-text-muted'
              }`}>
                {selected.includes(i) && (
                  <svg className="w-2.5 h-2.5 text-white animate-scaleIn" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-accent font-mono">{test.key}</span>
                  <span className="text-xs text-text-primary truncate">{test.title}</span>
                </div>
              </div>
              <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                test.status === 'Under Review' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'
              }`}>
                {test.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex gap-2 mt-3 animate-fadeInUp">
          <button className="flex-1 px-2 py-1.5 bg-success text-white text-xs rounded hover:bg-success/90">
            Approve Selected
          </button>
          <button className="flex-1 px-2 py-1.5 bg-sidebar text-text-primary text-xs rounded border border-border">
            Request Changes
          </button>
        </div>
      )}
    </div>
  );
}

// Feature 6: Browse Xray Entities Demo
function BrowseXrayDemo() {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  useEffect(() => {
    const sequence = [
      () => setExpanded(['plans']),
      () => setSelectedEntity('Sprint 1'),
      () => setExpanded(['plans', 'sets']),
      () => setSelectedEntity('Login Tests'),
      () => { setExpanded([]); setSelectedEntity(null); },
    ];
    let step = 0;
    const timer = setInterval(() => {
      sequence[step]();
      step = (step + 1) % sequence.length;
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  const entities = [
    { id: 'plans', label: 'Test Plans', icon: '📋', items: ['Sprint 1', 'Sprint 2', 'Regression'], count: 3 },
    { id: 'sets', label: 'Test Sets', icon: '📁', items: ['Login Tests', 'API Tests'], count: 2 },
    { id: 'execs', label: 'Test Executions', icon: '▶️', items: ['Daily Run', 'Nightly'], count: 2 },
  ];

  return (
    <div className="bg-background rounded-lg border border-border p-4 w-full max-w-lg h-[250px] overflow-hidden">
      <div className="space-y-2">
        {entities.map(entity => (
          <div key={entity.id}>
            <div
              className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all ${
                expanded.includes(entity.id) ? 'bg-accent/10' : 'bg-sidebar hover:bg-sidebar-hover'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg
                  className={`w-3 h-3 text-text-muted transition-transform ${expanded.includes(entity.id) ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-sm">{entity.icon}</span>
                <span className="text-xs text-text-primary">{entity.label}</span>
              </div>
              <span className="text-[10px] text-text-muted bg-background px-1.5 py-0.5 rounded">{entity.count}</span>
            </div>

            {/* Expanded items */}
            {expanded.includes(entity.id) && (
              <div className="ml-6 mt-1 space-y-1 animate-fadeIn">
                {entity.items.map(item => (
                  <div
                    key={item}
                    className={`flex items-center justify-between p-1.5 rounded text-xs transition-all ${
                      selectedEntity === item ? 'bg-accent text-white' : 'bg-sidebar/50 text-text-primary'
                    }`}
                  >
                    <span>{item}</span>
                    {selectedEntity === item && (
                      <svg className="w-3 h-3 animate-scaleIn" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedEntity && (
        <div className="mt-3 p-2 bg-sidebar rounded border border-border animate-slideInRight">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-primary">{selectedEntity}</span>
            <span className="text-[10px] text-success">12 tests</span>
          </div>
          <div className="flex gap-3 text-[10px] text-text-muted">
            <span>✅ 8 passed</span>
            <span>❌ 2 failed</span>
            <span>⏭ 2 skipped</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Main features data with demo components
const features = [
  {
    title: 'Create Test Cases',
    subtitle: 'Guided 3-step workflow',
    description: 'Draft test cases offline with auto-save. Add test steps with drag & drop reordering.',
    demo: CreateTestCaseDemo,
    highlights: ['Structured summary with Area | Layer | Title', 'Rich test steps with Action, Data, Result', 'Code snippet detection in test data', 'Works offline - syncs when ready'],
  },
  {
    title: 'Smart Xray Linking',
    subtitle: 'Connect to everything',
    description: 'Link tests to Test Plans, Executions, Sets, and Folders before importing.',
    demo: XrayLinkingDemo,
    highlights: ['Search & multi-select Test Plans', 'Link to Test Executions for runs', 'Organize into Test Sets', 'Place in folder hierarchy'],
  },
  {
    title: 'One-Click Import',
    subtitle: 'Seamless sync to Xray',
    description: 'Import test cases to Xray Cloud with automatic linking to all selected entities.',
    demo: ImportDemo,
    highlights: ['Creates Jira issue automatically', 'Parallel linking for speed', 'Progress tracking', 'Detailed success/error reporting'],
  },
  {
    title: 'Dashboard',
    subtitle: 'Everything at a glance',
    description: 'See all drafts, filter by status, search across test cases, and track progress.',
    demo: DashboardDemo,
    highlights: ['Filter by Draft / Ready / Imported', 'Full-text search', 'Quick edit and import actions', 'Import history tracking'],
  },
  {
    title: 'TC Review Queue',
    subtitle: 'Streamline approvals',
    description: 'Track tests that need review. See "Under Review" or "Draft" status tests in one place.',
    demo: TCReviewDemo,
    highlights: ['Filter by Jira workflow status', 'Bulk selection', 'One-click approval workflow', 'Jump to Jira instantly'],
  },
  {
    title: 'Browse Xray Entities',
    subtitle: 'Explore your project',
    description: 'Navigate Test Plans, Test Sets, Test Executions, and see their contents.',
    demo: BrowseXrayDemo,
    highlights: ['Expandable entity tree', 'View tests in each entity', 'Execution status breakdown', 'Quick entity search'],
  },
];

export function FeatureDemo({ onClose }: FeatureDemoProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const feature = features[currentIndex];
  const DemoComponent = feature.demo;

  const next = () => setCurrentIndex(i => (i + 1) % features.length);
  const prev = () => setCurrentIndex(i => (i - 1 + features.length) % features.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <AnimationStyles />

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal - Fixed size to prevent resizing during animations */}
      <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-border">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-text-muted hover:text-text-primary hover:bg-sidebar-hover rounded-lg transition-colors z-10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-text-primary">{feature.title}</h2>
            <p className="text-sm text-accent">{feature.subtitle}</p>
          </div>

          {/* Demo - Fixed height container to prevent resizing */}
          <div className="mb-4 h-[280px] flex items-center justify-center">
            <DemoComponent />
          </div>

          {/* Description */}
          <p className="text-sm text-text-secondary text-center mb-4">{feature.description}</p>

          {/* Highlights */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {feature.highlights.map((h, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-text-primary animate-fadeIn"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <svg className="w-4 h-4 text-success flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{h}</span>
              </div>
            ))}
          </div>

          {/* Navigation dots */}
          <div className="flex justify-center gap-2 mb-4">
            {features.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === currentIndex ? 'bg-accent w-6' : 'bg-border w-2 hover:bg-text-muted'
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={prev} disabled={currentIndex === 0}>
              ← Previous
            </Button>

            <span className="text-sm text-text-muted">
              {currentIndex + 1} / {features.length}
            </span>

            {currentIndex < features.length - 1 ? (
              <Button variant="ghost" onClick={next}>
                Next →
              </Button>
            ) : (
              <Button onClick={onClose}>
                Get Started
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
