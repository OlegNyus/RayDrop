import { useApp } from '../../context/AppContext';

interface TestKeyLinkProps {
  testKey: string;
  className?: string;
}

export function TestKeyLink({ testKey, className = '' }: TestKeyLinkProps) {
  const { config } = useApp();

  const jiraUrl = config?.jiraBaseUrl
    ? `${config.jiraBaseUrl}/browse/${testKey}`
    : null;

  if (!jiraUrl) {
    return (
      <span className={`text-xs font-mono text-success bg-success/10 px-1.5 py-0.5 rounded ${className}`}>
        {testKey}
      </span>
    );
  }

  return (
    <a
      href={jiraUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`text-xs font-mono text-success bg-success/10 px-1.5 py-0.5 rounded hover:bg-success/20 transition-colors ${className}`}
    >
      {testKey} ↗
    </a>
  );
}
