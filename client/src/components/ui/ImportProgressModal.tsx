import type { ImportProgress } from '../../hooks/useImportToXray';

interface ImportProgressModalProps {
  progress: ImportProgress;
  onClose: () => void;
  jiraBaseUrl?: string;
}

export function ImportProgressModal({ progress, onClose, jiraBaseUrl }: ImportProgressModalProps) {
  if (!progress.isOpen) return null;

  const completedSteps = progress.steps.filter(s => s.status === 'completed').length;
  const failedSteps = progress.steps.filter(s => s.status === 'failed').length;
  const totalSteps = progress.steps.length;
  const percentComplete = totalSteps > 0 ? Math.round(((completedSteps + failedSteps) / totalSteps) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border text-center">
          <h2 className="text-lg font-semibold text-text-primary">One-Click Import</h2>
          <p className="text-sm text-accent">Seamless sync to Xray Cloud</p>
        </div>

        {/* Content - Fixed height */}
        <div className="p-6 h-[280px] flex flex-col">
          {progress.phase === 'importing' || progress.phase === 'validating' ? (
            /* Importing/Validating State */
            <div className="flex flex-col h-full">
              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-text-muted mb-2">
                  <span>{progress.phase === 'validating' ? 'Validating links...' : 'Importing...'}</span>
                  <span>{progress.phase === 'validating' ? '100%' : `${percentComplete}%`}</span>
                </div>
                <div className="h-2 bg-sidebar rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300 ease-out rounded-full"
                    style={{ width: progress.phase === 'validating' ? '100%' : `${percentComplete}%` }}
                  />
                </div>
              </div>

              {/* Steps - Scrollable */}
              <div className="flex-1 space-y-2 overflow-y-auto">
                {progress.steps.map((step, index) => {
                  if (step.status === 'pending' && index > progress.currentStepIndex) return null;

                  return (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 animate-fadeIn"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      {step.status === 'completed' ? (
                        <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : step.status === 'failed' ? (
                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      ) : step.status === 'in-progress' ? (
                        <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-text-muted flex-shrink-0" />
                      )}
                      <span className={`text-sm ${
                        step.status === 'completed' ? 'text-accent' :
                        step.status === 'failed' ? 'text-red-500' :
                        step.status === 'in-progress' ? 'text-text-primary font-medium' :
                        'text-text-muted'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
                {/* Validating step indicator */}
                {progress.phase === 'validating' && (
                  <div className="flex items-center gap-3 animate-fadeIn">
                    <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin flex-shrink-0" />
                    <span className="text-sm text-text-primary font-medium">Verifying links in Xray...</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Complete State */
            <div className="flex flex-col items-center justify-center text-center h-full animate-scaleIn">
              {progress.hasErrors && !progress.testKey ? (
                /* Full failure - Test creation failed */
                <>
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <span className="text-lg font-semibold text-red-500">
                    {progress.isReusable ? 'Update Failed' : 'Import Failed'}
                  </span>
                  <span className="text-sm text-text-muted mt-2">
                    Failed to {progress.isReusable ? 'update' : 'create'} test case in Jira. Please check your connection and try again.
                  </span>
                </>
              ) : progress.hasErrors && progress.testKey ? (
                /* Partial success - Test created but some links failed */
                <>
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <span className="text-lg font-semibold text-amber-500">
                    {progress.isReusable ? 'Updated with Warnings' : 'Imported with Warnings'}
                  </span>
                  <span className="text-sm text-text-muted mt-1">
                    <span className="font-mono text-accent">{progress.testKey}</span> {progress.isReusable ? 'updated' : 'created'} in Jira
                  </span>

                  {/* Success badges */}
                  {progress.linkedItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 justify-center max-h-[60px] overflow-y-auto">
                      {progress.linkedItems.map((item, i) => (
                        item.key && jiraBaseUrl ? (
                          <a
                            key={i}
                            href={`${jiraBaseUrl}browse/${item.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-accent/10 text-accent text-xs rounded hover:bg-accent/20 transition-colors"
                          >
                            {item.key}
                          </a>
                        ) : (
                          <span key={i} className="px-2 py-1 bg-accent/10 text-accent text-xs rounded">
                            {item.label}
                          </span>
                        )
                      ))}
                    </div>
                  )}

                  {/* Failed items */}
                  {progress.failedItems.length > 0 && (
                    <div className="mt-3 w-full">
                      <p className="text-xs text-red-500 font-medium mb-2">Failed to link:</p>
                      <div className="space-y-1 text-left max-h-[80px] overflow-y-auto">
                        {progress.failedItems.map((item, i) => (
                          <div key={i} className="text-xs text-red-400 flex items-start gap-2">
                            <span className="flex-shrink-0">•</span>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Validation status for partial success */}
                  {progress.validation?.isValidated && (
                    <span className="text-xs text-text-muted mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Links verified in Xray
                    </span>
                  )}
                </>
              ) : (
                /* Full success */
                <>
                  <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-lg font-semibold text-success">
                    {progress.isReusable ? 'Update Complete!' : 'Import Complete!'}
                  </span>
                  {progress.testKey && (
                    <span className="text-sm text-text-muted mt-1">
                      <span className="font-mono text-accent">{progress.testKey}</span> {progress.isReusable ? 'updated' : 'created'} in Jira
                    </span>
                  )}

                  {/* Linked items badges */}
                  {progress.linkedItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4 justify-center max-h-[80px] overflow-y-auto">
                      {progress.linkedItems.map((item, i) => (
                        item.key && jiraBaseUrl ? (
                          <a
                            key={i}
                            href={`${jiraBaseUrl}browse/${item.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-accent/10 text-accent text-xs rounded hover:bg-accent/20 transition-colors"
                          >
                            {item.key}
                          </a>
                        ) : (
                          <span key={i} className="px-2 py-1 bg-accent/10 text-accent text-xs rounded">
                            {item.label}
                          </span>
                        )
                      ))}
                    </div>
                  )}

                  {/* Validation status */}
                  {progress.validation?.isValidated ? (
                    <span className="text-xs text-success mt-3 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Links verified in Xray
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted mt-3">Verification pending</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer - Only show when complete */}
        {progress.phase === 'complete' && (
          <div className="px-6 py-4 border-t border-border flex justify-center">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
