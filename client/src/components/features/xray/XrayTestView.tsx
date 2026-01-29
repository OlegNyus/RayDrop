import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { xrayApi } from '../../../services/api';
import { Card, Button, CodeBlock } from '../../ui';
import { detectCode } from '../../../utils/codeDetection';

// Parse Jira wiki markup links [text|url] and plain URLs into clickable links
function parseJiraMarkup(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\[([^\]|]+)\|([^\]]+)\]|(https?:\/\/[^\s\]]+)/g;
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      parts.push(
        <a
          key={keyIndex++}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          {match[1]}
        </a>
      );
    } else if (match[3]) {
      parts.push(
        <a
          key={keyIndex++}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline break-all"
        >
          {match[3]}
        </a>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

interface TestDetails {
  issueId: string;
  key: string;
  summary: string;
  description: string;
  testType: string;
  priority: string;
  labels: string[];
  steps: Array<{ id: string; action: string; data: string; result: string }>;
}

export function XrayTestView() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { config } = useApp();
  const [test, setTest] = useState<TestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const jiraBaseUrl = config?.jiraBaseUrl;

  useEffect(() => {
    if (!issueId) return;

    const fetchTest = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await xrayApi.getTestDetails(issueId);
        setTest(data);
      } catch (err) {
        console.error('Failed to fetch test:', err);
        setError(err instanceof Error ? err.message : 'Failed to load test');
      } finally {
        setLoading(false);
      }
    };

    fetchTest();
  }, [issueId]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-sidebar rounded" />
          <div className="h-4 w-96 bg-sidebar rounded" />
          <Card>
            <div className="space-y-3">
              <div className="h-4 w-full bg-sidebar rounded" />
              <div className="h-4 w-3/4 bg-sidebar rounded" />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-error/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">Failed to Load Test</h3>
          <p className="text-text-muted mb-4">{error || 'Test not found'}</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </Card>
      </div>
    );
  }

  const jiraUrl = jiraBaseUrl ? `${jiraBaseUrl}/browse/${test.key}` : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="mt-1 p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-sidebar-hover transition-colors"
            title="Go back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xl font-bold text-accent">{test.key}</span>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-accent/10 text-accent">
                {test.testType}
              </span>
              {test.priority && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-sidebar text-text-secondary">
                  {test.priority}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-text-primary">{test.summary}</h1>
          </div>
        </div>

        {/* Jira link */}
        {jiraUrl && (
          <a
            href={jiraUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-primary bg-sidebar-hover hover:bg-sidebar-hover/80 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 11.513H0a5.218 5.218 0 005.232 5.215h2.13v2.057A5.215 5.215 0 0012.574 24V12.518a1.005 1.005 0 00-1.003-1.005zm5.723-5.756H5.736a5.215 5.215 0 005.215 5.214h2.129v2.058a5.218 5.218 0 005.215 5.214V6.758a1.001 1.001 0 00-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 005.215 5.215h2.129v2.057A5.215 5.215 0 0024 12.483V1.005A1.001 1.001 0 0023.013 0z"/>
            </svg>
            Open in Jira
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>

      {/* Description */}
      {test.description && (
        <Card>
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-3">Description</h2>
          <div className="text-text-primary whitespace-pre-wrap">{parseJiraMarkup(test.description)}</div>
        </Card>
      )}

      {/* Labels */}
      {test.labels && test.labels.length > 0 && (
        <Card>
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-3">Labels</h2>
          <div className="flex flex-wrap gap-2">
            {test.labels.map(label => (
              <span
                key={label}
                className="px-2.5 py-1 text-sm rounded-full bg-accent/10 text-accent"
              >
                {label}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Test Steps */}
      <Card>
        <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
          Test Steps ({test.steps.length})
        </h2>

        {test.steps.length === 0 ? (
          <p className="text-text-muted py-4 text-center">No test steps defined</p>
        ) : (
          <div className="space-y-4">
            {test.steps.map((step, index) => (
              <StepCard key={step.id} step={step} index={index} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Step card component
function StepCard({ step, index }: { step: { id: string; action: string; data: string; result: string }; index: number }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Step header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-sidebar/50 border-b border-border">
        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-accent text-white text-sm font-medium">
          {index + 1}
        </span>
        <span className="text-sm font-medium text-text-primary">Step {index + 1}</span>
      </div>

      {/* Step content */}
      <div className="p-4 space-y-3">
        {/* Action */}
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Action</p>
          <p className="text-text-primary whitespace-pre-wrap">{step.action || '-'}</p>
        </div>

        {/* Data */}
        {step.data && (
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Data</p>
            <TestDataDisplay data={step.data} />
          </div>
        )}

        {/* Expected Result */}
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Expected Result</p>
          <p className="text-text-primary whitespace-pre-wrap">{step.result || '-'}</p>
        </div>
      </div>
    </div>
  );
}

// Test data display component - handles both raw code and Xray wiki format
function TestDataDisplay({ data }: { data: string }) {
  // Strip Xray wiki code format if present: {code:lang}...{code}
  const wikiCodeMatch = data.match(/^\{code(?::(\w+))?\}\n?([\s\S]*?)\n?\{code\}$/);
  const cleanData = wikiCodeMatch ? wikiCodeMatch[2] : data;

  const { isCode } = detectCode(cleanData);

  if (isCode || wikiCodeMatch) {
    return <CodeBlock code={cleanData} />;
  }

  return <p className="text-text-secondary whitespace-pre-wrap">{data}</p>;
}
