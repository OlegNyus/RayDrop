import { useState } from 'react';
import { Card } from '../../ui';

interface CollapsibleSectionProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ icon, title, subtitle, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 text-left"
        aria-expanded={isOpen}
      >
        <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <p className="text-sm text-text-muted">{subtitle}</p>
        </div>
        <svg
          className={`w-5 h-5 text-text-muted transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-border text-sm text-text-secondary space-y-3">
          {children}
        </div>
      )}
    </Card>
  );
}

export function HelpPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-text-primary">Help</h1>

      {/* 1. Getting Started */}
      <CollapsibleSection
        defaultOpen
        icon={
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
        title="Getting Started"
        subtitle="First launch and connecting to Xray"
      >
        <p>When you open RayDrop for the first time, you'll see a setup screen. Here's what to do:</p>
        <ol className="list-decimal list-inside space-y-2">
          <li>Enter your <span className="font-medium text-text-primary">Jira Base URL</span> — this is the address of your Jira instance (e.g. <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">https://yourteam.atlassian.net</code>).</li>
          <li>Enter your <span className="font-medium text-text-primary">Xray Client ID</span> and <span className="font-medium text-text-primary">Client Secret</span>. You can find these in Xray Cloud under <span className="font-medium text-text-primary">Settings &gt; API Keys</span>.</li>
          <li>Click <span className="font-medium text-text-primary">Save & Connect</span>. RayDrop will verify the credentials.</li>
          <li>Once connected, go to <span className="font-medium text-text-primary">Settings</span> and add a project key (e.g. <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">QA</code> or <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">PROJ</code>). This tells RayDrop which Jira project to work with.</li>
        </ol>
        <p>After that, you're ready to create and manage test cases.</p>
      </CollapsibleSection>

      {/* 2. Creating Test Cases */}
      <CollapsibleSection
        icon={
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        }
        title="Creating Test Cases"
        subtitle="The 3-step wizard"
      >
        <p>Click <span className="font-medium text-text-primary">Create Test Case</span> in the sidebar to open the wizard. There are 3 steps:</p>
        <ol className="list-decimal list-inside space-y-2">
          <li><span className="font-medium text-text-primary">Basic Info</span> — Give your test case a name, folder path, and priority. You can also set a status and add labels.</li>
          <li><span className="font-medium text-text-primary">Test Steps</span> — Add one or more steps. Each step has an <span className="font-medium text-text-primary">Action</span>, optional <span className="font-medium text-text-primary">Data</span>, and an <span className="font-medium text-text-primary">Expected Result</span>. You can reorder steps by drag-and-drop.</li>
          <li><span className="font-medium text-text-primary">Xray Linking</span> — Optionally link the test case to existing Xray Test Sets, Test Plans, or Preconditions by entering their issue keys.</li>
        </ol>
        <p>When you're done, click <span className="font-medium text-text-primary">Save as Draft</span> to store it locally, or <span className="font-medium text-text-primary">Import to Xray</span> to send it directly.</p>
      </CollapsibleSection>

      {/* 3. Importing to Xray */}
      <CollapsibleSection
        icon={
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        }
        title="Importing to Xray"
        subtitle="One-click import to Xray Cloud"
      >
        <p>There are two ways to import test cases:</p>
        <h3 className="font-medium text-text-primary">Single Import</h3>
        <p>Open a draft test case and click the <span className="font-medium text-text-primary">Import to Xray</span> button. RayDrop will create the test in Xray and return a test key (e.g. <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">QA-123</code>).</p>
        <h3 className="font-medium text-text-primary">Bulk Import</h3>
        <p>From the <span className="font-medium text-text-primary">Test Cases</span> list, select multiple drafts using the checkboxes, then click <span className="font-medium text-text-primary">Bulk Import</span>. All selected test cases will be imported in one batch.</p>
        <p>After import, the test case status changes to <span className="font-medium text-text-primary">Imported</span> and the Xray test key is linked automatically.</p>
      </CollapsibleSection>

      {/* 4. Managing Test Cases */}
      <CollapsibleSection
        icon={
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        }
        title="Managing Test Cases"
        subtitle="Drafts, statuses, and bulk actions"
      >
        <p>The <span className="font-medium text-text-primary">Test Cases</span> page shows all drafts for the selected project.</p>
        <h3 className="font-medium text-text-primary">Statuses</h3>
        <ul className="list-disc list-inside space-y-2">
          <li><span className="font-medium text-text-primary">Draft</span> — Saved locally, not yet sent to Xray.</li>
          <li><span className="font-medium text-text-primary">Ready for Review</span> — Marked as complete and waiting for review.</li>
          <li><span className="font-medium text-text-primary">Imported</span> — Successfully pushed to Xray with a linked test key.</li>
        </ul>
        <h3 className="font-medium text-text-primary">Actions</h3>
        <ul className="list-disc list-inside space-y-2">
          <li><span className="font-medium text-text-primary">Edit</span> — Click a test case to open it in the editor.</li>
          <li><span className="font-medium text-text-primary">Delete</span> — Remove a draft permanently (won't affect Xray).</li>
          <li><span className="font-medium text-text-primary">Filter</span> — Use the search bar and status filters to find specific test cases.</li>
        </ul>
      </CollapsibleSection>

      {/* 5. Xray Entities */}
      <CollapsibleSection
        icon={
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        }
        title="Xray Entities"
        subtitle="Browsing Test Plans, Sets, and more"
      >
        <p>The sidebar has links to browse Xray entities for your active project:</p>
        <ul className="list-disc list-inside space-y-2">
          <li><span className="font-medium text-text-primary">Test Sets</span> — Groups of related test cases.</li>
          <li><span className="font-medium text-text-primary">Test Plans</span> — High-level plans that organize test executions.</li>
          <li><span className="font-medium text-text-primary">Test Executions</span> — Records of test runs and their results.</li>
          <li><span className="font-medium text-text-primary">Preconditions</span> — Setup steps that must be true before a test runs.</li>
        </ul>
        <p>These views are <span className="font-medium text-text-primary">read-only</span> — they let you look up issue keys and details without leaving RayDrop. Use them when linking test cases during creation.</p>
      </CollapsibleSection>

      {/* 6. Running with Docker */}
      <CollapsibleSection
        icon={
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
        }
        title="Running with Docker"
        subtitle="No developer tools needed"
      >
        <h3 className="font-medium text-text-primary">Before you begin</h3>
        <ul className="list-disc list-inside space-y-2">
          <li>Install <span className="font-medium text-text-primary">Docker Desktop</span> from <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">docker.com/products/docker-desktop</code> (Mac, Windows, or Linux).</li>
          <li>Make sure Docker Desktop is <span className="font-medium text-text-primary">running</span> — look for the whale icon in your system tray (Windows) or menu bar (Mac).</li>
          <li>Have the RayDrop project folder on your machine (downloaded or cloned from the repository).</li>
        </ul>

        <h3 className="font-medium text-text-primary">Starting RayDrop — Mac / Linux</h3>
        <ol className="list-decimal list-inside space-y-2">
          <li>Open <span className="font-medium text-text-primary">Terminal</span> (on Mac: Spotlight &gt; type "Terminal" &gt; Enter).</li>
          <li>Navigate to the RayDrop folder: <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">cd path/to/RayDrop</code></li>
          <li>Run: <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">docker compose up</code></li>
          <li>Wait for the logs to show that the server is ready (you'll see output with port numbers).</li>
          <li>Open your browser and go to <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">http://localhost:5173</code>.</li>
        </ol>

        <h3 className="font-medium text-text-primary">Starting RayDrop — Windows</h3>
        <ol className="list-decimal list-inside space-y-2">
          <li>Open <span className="font-medium text-text-primary">PowerShell</span> (Start menu &gt; type "PowerShell" &gt; Enter).</li>
          <li>Navigate to the RayDrop folder: <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">cd path\to\RayDrop</code></li>
          <li>Run: <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">docker compose up</code></li>
          <li>Wait for the logs to show that the server is ready.</li>
          <li>Open your browser and go to <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">http://localhost:5173</code>.</li>
        </ol>

        <h3 className="font-medium text-text-primary">Stopping RayDrop</h3>
        <ol className="list-decimal list-inside space-y-2">
          <li>Go back to the terminal window where RayDrop is running.</li>
          <li>Press <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">Ctrl+C</code> to stop the containers.</li>
          <li>Optionally run <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">docker compose down</code> to fully remove the containers (your data is preserved).</li>
        </ol>
      </CollapsibleSection>

      {/* 7. Updating RayDrop */}
      <CollapsibleSection
        icon={
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        }
        title="Updating RayDrop"
        subtitle="How to get the latest version"
      >
        <h3 className="font-medium text-text-primary">Docker users</h3>
        <p>Pull the latest image and restart:</p>
        <code className="block px-3 py-2 bg-background rounded text-text-primary text-xs font-mono">docker compose pull && docker compose up</code>
        <h3 className="font-medium text-text-primary">Developer setup</h3>
        <p>Pull the latest code and install dependencies:</p>
        <code className="block px-3 py-2 bg-background rounded text-text-primary text-xs font-mono">git pull && npm install</code>
        <p>Your test case data is stored in a local database file and is <span className="font-medium text-text-primary">preserved across updates</span>.</p>
      </CollapsibleSection>

      {/* 8. Troubleshooting */}
      <CollapsibleSection
        icon={
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        title="Troubleshooting"
        subtitle="Common issues and quick fixes"
      >
        <h3 className="font-medium text-text-primary">Docker won't start</h3>
        <p>Make sure <span className="font-medium text-text-primary">Docker Desktop</span> is running before you execute <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">docker compose up</code>. On Mac, check for the whale icon in the menu bar.</p>

        <h3 className="font-medium text-text-primary">Port already in use</h3>
        <p>If you see a port conflict, another app is using port <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">5173</code> or <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">3000</code>. Stop the other app, or change the port in <code className="px-1.5 py-0.5 bg-background rounded text-text-primary text-xs font-mono">docker-compose.yml</code>.</p>

        <h3 className="font-medium text-text-primary">Invalid credentials</h3>
        <p>Double-check your Client ID and Secret in <span className="font-medium text-text-primary">Settings</span>. They must match the API key from Xray Cloud (not Jira API tokens). Regenerate the key in Xray if needed.</p>

        <h3 className="font-medium text-text-primary">No data showing</h3>
        <p>Make sure you have selected a <span className="font-medium text-text-primary">project</span> in the sidebar dropdown, and that the project key matches an existing Jira project with Xray enabled.</p>
      </CollapsibleSection>
    </div>
  );
}
