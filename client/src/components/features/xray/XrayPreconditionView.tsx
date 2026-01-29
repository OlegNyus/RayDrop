import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { xrayApi } from '../../../services/api';
import { Card, Button } from '../../ui';

// Parse Jira wiki markup links [text|url] and plain URLs into clickable links
function parseJiraMarkup(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match [text|url] pattern or plain URLs
  const regex = /\[([^\]|]+)\|([^\]]+)\]|(https?:\/\/[^\s\]]+)/g;
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // [text|url] format
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
      // Plain URL
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

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

interface PreconditionDetails {
  issueId: string;
  key: string;
  summary: string;
  description: string;
  preconditionType: string;
  definition: string;
  priority: string;
  labels: string[];
}

export function XrayPreconditionView() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { config } = useApp();
  const [precondition, setPrecondition] = useState<PreconditionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const jiraBaseUrl = config?.jiraBaseUrl;

  useEffect(() => {
    if (!issueId) return;

    const fetchPrecondition = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await xrayApi.getPreconditionDetails(issueId);
        setPrecondition(data);
      } catch (err) {
        console.error('Failed to fetch precondition:', err);
        setError(err instanceof Error ? err.message : 'Failed to load precondition');
      } finally {
        setLoading(false);
      }
    };

    fetchPrecondition();
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

  if (error || !precondition) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-error/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">Failed to Load Precondition</h3>
          <p className="text-text-muted mb-4">{error || 'Precondition not found'}</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </Card>
      </div>
    );
  }

  const jiraUrl = jiraBaseUrl ? `${jiraBaseUrl}/browse/${precondition.key}` : null;

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
              <span className="text-xl font-bold" style={{ color: '#EC4899' }}>{precondition.key}</span>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: '#EC489920', color: '#EC4899' }}>
                {precondition.preconditionType}
              </span>
              {precondition.priority && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-sidebar text-text-secondary">
                  {precondition.priority}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-text-primary">{precondition.summary}</h1>
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
      {precondition.description && (
        <Card>
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-3">Description</h2>
          <div className="text-text-primary whitespace-pre-wrap">{parseJiraMarkup(precondition.description)}</div>
        </Card>
      )}

      {/* Labels */}
      {precondition.labels && precondition.labels.length > 0 && (
        <Card>
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-3">Labels</h2>
          <div className="flex flex-wrap gap-2">
            {precondition.labels.map(label => (
              <span
                key={label}
                className="px-2.5 py-1 text-sm rounded-full"
                style={{ backgroundColor: '#EC489920', color: '#EC4899' }}
              >
                {label}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Precondition Definition */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5" style={{ color: '#EC4899' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider">Precondition Definition</h2>
        </div>

        {precondition.definition ? (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="p-4 bg-sidebar/30">
              <pre className="text-text-primary whitespace-pre-wrap font-mono text-sm">
                {precondition.definition}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-text-muted py-4 text-center">No precondition definition provided</p>
        )}
      </Card>
    </div>
  );
}
