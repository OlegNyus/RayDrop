import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Input, Spinner } from '../../ui';
import { configApi } from '../../../services/api';
import { useTheme } from '../../../context/ThemeContext';

interface SetupFormProps {
  onComplete: (data: { xrayClientId: string; xrayClientSecret: string; jiraBaseUrl: string }) => void;
  onCancel?: () => void;
  initialConfig?: {
    xrayClientId?: string;
    xrayClientSecret?: string;
    jiraBaseUrl?: string;
  };
  isEditing?: boolean;
}

interface FormErrors {
  xrayClientId?: string;
  xrayClientSecret?: string;
  jiraSubdomain?: string;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'failure';

// Subdomain validation pattern: alphanumeric with hyphens, min 2 chars
const SUBDOMAIN_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

// Extract subdomain from full URL
function extractSubdomain(url: string): string {
  try {
    const parsed = new URL(url);
    const match = parsed.hostname.match(/^([^.]+)\.atlassian\.(net|com)$/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

// Build full Jira URL from subdomain
function buildJiraUrl(subdomain: string): string {
  return `https://${subdomain.toLowerCase().trim()}.atlassian.net/`;
}

export function SetupForm({
  onComplete,
  onCancel,
  initialConfig,
  isEditing = false,
}: SetupFormProps) {
  // Form state
  const [xrayClientId, setXrayClientId] = useState(initialConfig?.xrayClientId || '');
  const [xrayClientSecret, setXrayClientSecret] = useState(initialConfig?.xrayClientSecret || '');
  const [jiraSubdomain, setJiraSubdomain] = useState(
    initialConfig?.jiraBaseUrl ? extractSubdomain(initialConfig.jiraBaseUrl) : ''
  );

  // UI state
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Test connection state
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState('');

  // Timers ref for cleanup
  const timersRef = useRef<number[]>([]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Clear error when user types
  const clearFieldError = useCallback((field: keyof FormErrors) => {
    setErrors(prev => ({ ...prev, [field]: undefined }));
    setSubmitError('');
  }, []);

  // Validate form
  const validateForm = useCallback((forTestConnection = false): boolean => {
    const newErrors: FormErrors = {};

    // Client ID validation
    if (!xrayClientId.trim()) {
      newErrors.xrayClientId = 'Client ID is required';
    }

    // Client Secret validation
    if (!xrayClientSecret.trim()) {
      newErrors.xrayClientSecret = 'Client Secret is required';
    }

    // Subdomain validation (only for submit, not test connection)
    if (!forTestConnection) {
      const subdomain = jiraSubdomain.trim();
      if (!subdomain) {
        newErrors.jiraSubdomain = 'Jira subdomain is required';
      } else if (subdomain.length < 2) {
        newErrors.jiraSubdomain = 'Subdomain must be at least 2 characters';
      } else if (!SUBDOMAIN_PATTERN.test(subdomain)) {
        newErrors.jiraSubdomain = 'Subdomain can only contain letters, numbers, and hyphens';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [xrayClientId, xrayClientSecret, jiraSubdomain]);

  // Test connection handler
  const handleTestConnection = async () => {
    if (!validateForm(true)) return;

    setTestStatus('testing');
    setTestError('');

    try {
      await configApi.testConnection({
        xrayClientId: xrayClientId.trim(),
        xrayClientSecret: xrayClientSecret.trim(),
      });
      setTestStatus('success');

      // Auto-clear success after 5 seconds
      const timer = window.setTimeout(() => setTestStatus('idle'), 5000);
      timersRef.current.push(timer);
    } catch (error) {
      setTestStatus('failure');
      setTestError(error instanceof Error ? error.message : 'Invalid Client ID or Client Secret');

      // Auto-clear error after 5 seconds
      const timer = window.setTimeout(() => {
        setTestStatus('idle');
        setTestError('');
      }, 5000);
      timersRef.current.push(timer);
    }
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError('');
    setLoadingMessage('Validating...');

    // Progressive loading messages
    const timer1 = window.setTimeout(() => setLoadingMessage('Still connecting to Xray...'), 3000);
    const timer2 = window.setTimeout(() => setLoadingMessage('This is taking longer than usual...'), 8000);
    timersRef.current.push(timer1, timer2);

    try {
      const jiraBaseUrl = buildJiraUrl(jiraSubdomain);

      await configApi.save({
        xrayClientId: xrayClientId.trim(),
        xrayClientSecret: xrayClientSecret.trim(),
        jiraBaseUrl,
      });

      onComplete({
        xrayClientId: xrayClientId.trim(),
        xrayClientSecret: xrayClientSecret.trim(),
        jiraBaseUrl,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save configuration');
    } finally {
      setIsSubmitting(false);
      setLoadingMessage('');
      clearTimeout(timer1);
      clearTimeout(timer2);
    }
  };

  // Generate URL preview
  const urlPreview = jiraSubdomain.trim()
    ? buildJiraUrl(jiraSubdomain)
    : null;

  const isSubdomainValid = jiraSubdomain.trim().length >= 2 && SUBDOMAIN_PATTERN.test(jiraSubdomain.trim());

  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      {/* Theme Toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary hover:bg-sidebar-hover rounded-lg transition-colors"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>

      <Card className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-accent/10 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-text-primary">
              {isEditing ? 'Edit Configuration' : 'Welcome to RayDrop'}
            </h1>
            <p className="text-sm text-text-secondary mt-2">
              {isEditing
                ? 'Update your Xray Cloud API credentials'
                : 'Enter your Xray Cloud API credentials to get started'}
            </p>
          </div>

          {/* Client ID */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-primary">
              Client ID <span className="text-error">*</span>
            </label>
            <Input
              type="text"
              value={xrayClientId}
              onChange={e => {
                setXrayClientId(e.target.value);
                clearFieldError('xrayClientId');
              }}
              placeholder="Enter your Xray Client ID"
              error={errors.xrayClientId}
              disabled={isSubmitting}
            />
          </div>

          {/* Client Secret */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-primary">
              Client Secret <span className="text-error">*</span>
            </label>
            <Input
              type="password"
              value={xrayClientSecret}
              onChange={e => {
                setXrayClientSecret(e.target.value);
                clearFieldError('xrayClientSecret');
              }}
              placeholder="Enter your Xray Client Secret"
              error={errors.xrayClientSecret}
              disabled={isSubmitting}
            />
          </div>

          {/* Test Connection Button */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestConnection}
              disabled={isSubmitting || testStatus === 'testing' || !xrayClientId.trim() || !xrayClientSecret.trim()}
            >
              {testStatus === 'testing' ? (
                <>
                  <Spinner size="sm" />
                  <span className="ml-2">Validating...</span>
                </>
              ) : (
                'Test Connection'
              )}
            </Button>

            {/* Test Result */}
            {testStatus === 'success' && (
              <span className="flex items-center gap-1 text-sm text-success">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Connection successful
              </span>
            )}
            {testStatus === 'failure' && (
              <span className="flex items-center gap-1 text-sm text-error">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {testError}
              </span>
            )}
          </div>

          {/* Jira Subdomain */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-primary">
              Jira Subdomain <span className="text-error">*</span>
            </label>
            <div className={`flex items-center rounded-lg border overflow-hidden transition-all ${
              errors.jiraSubdomain
                ? 'border-error'
                : 'border-input-border focus-within:ring-2 focus-within:ring-accent focus-within:border-accent'
            }`}>
              <span className="px-3 py-2 bg-sidebar text-sm text-text-muted border-r border-input-border">
                https://
              </span>
              <input
                type="text"
                value={jiraSubdomain}
                onChange={e => {
                  setJiraSubdomain(e.target.value);
                  clearFieldError('jiraSubdomain');
                }}
                placeholder="your-company"
                disabled={isSubmitting}
                className="flex-1 px-3 py-2 bg-input-bg text-text-primary placeholder-text-muted focus:outline-none min-w-0"
              />
              <span className="px-3 py-2 bg-sidebar text-sm text-text-muted border-l border-input-border">
                .atlassian.net
              </span>
            </div>
            {errors.jiraSubdomain && (
              <p className="text-xs text-error">{errors.jiraSubdomain}</p>
            )}

            {/* URL Preview */}
            {urlPreview && (
              <p className={`text-xs mt-1 ${isSubdomainValid ? 'text-success' : 'text-text-muted'}`}>
                {urlPreview}
              </p>
            )}
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-error rounded-lg">
              <p className="text-sm text-error">{submitError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {isEditing && onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className={isEditing && onCancel ? 'flex-1' : 'w-full'}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" />
                  <span className="ml-2">{loadingMessage || 'Validating...'}</span>
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Validate & Save Configuration'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
