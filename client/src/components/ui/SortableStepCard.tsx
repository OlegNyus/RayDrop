import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TestStep } from '../../types';
import { CodeBlock } from './CodeBlock';
import { detectCode } from '../../utils/codeDetection';

interface SortableStepCardProps {
  step: TestStep;
  index: number;
  totalSteps: number;
  onChange: (field: keyof TestStep, value: string) => void;
  onRemove: () => void;
  errors?: {
    action?: string;
    result?: string;
  };
}

export function SortableStepCard({
  step,
  index,
  totalSteps,
  onChange,
  onRemove,
  errors,
}: SortableStepCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-4 bg-background rounded-lg border border-border space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="p-1 cursor-grab hover:bg-sidebar-hover rounded text-text-muted"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </button>
          <span className="text-sm font-medium text-text-secondary">
            Step {index + 1}
          </span>
        </div>

        {/* Remove Button */}
        {totalSteps > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 hover:bg-sidebar-hover rounded text-text-muted hover:text-error"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Action */}
      <div className="space-y-1">
        <label className="text-xs text-text-muted">
          Action <span className="text-error">*</span>
        </label>
        <textarea
          value={step.action}
          onChange={e => onChange('action', e.target.value)}
          placeholder="What action should be performed?"
          className={`w-full px-3 py-2 bg-input-bg border rounded-lg text-text-primary placeholder-text-muted text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-accent ${
            errors?.action ? 'border-error' : 'border-input-border'
          }`}
        />
        {errors?.action && <p className="text-xs text-error">{errors.action}</p>}
      </div>

      {/* Test Data */}
      <TestDataField
        value={step.data}
        onChange={(value) => onChange('data', value)}
      />

      {/* Expected Result */}
      <div className="space-y-1">
        <label className="text-xs text-text-muted">
          Expected Result <span className="text-error">*</span>
        </label>
        <textarea
          value={step.result}
          onChange={e => onChange('result', e.target.value)}
          placeholder="What is the expected outcome?"
          className={`w-full px-3 py-2 bg-input-bg border rounded-lg text-text-primary placeholder-text-muted text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-accent ${
            errors?.result ? 'border-error' : 'border-input-border'
          }`}
        />
        {errors?.result && <p className="text-xs text-error">{errors.result}</p>}
      </div>
    </div>
  );
}

// Test Data field component with code detection
interface TestDataFieldProps {
  value: string;
  onChange: (value: string) => void;
}

function TestDataField({ value, onChange }: TestDataFieldProps) {
  const [isEditing, setIsEditing] = useState(!value); // Start in edit mode if empty
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isCode } = detectCode(value);

  // Auto-resize textarea based on content
  const autoResize = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(80, textarea.scrollHeight)}px`;
  };

  // Focus and resize textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      // Auto-resize to fit content
      autoResize(textareaRef.current);
    }
  }, [isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    autoResize(e.target);
  };

  const exitEditMode = () => {
    setIsEditing(false);
  };

  // Edit mode - show textarea
  if (isEditing) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-text-muted">Test Data</label>
          {value && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur from firing first
                exitEditMode();
              }}
              className="text-xs text-accent hover:text-accent/80 flex items-center gap-1"
            >
              Done
            </button>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onBlur={exitEditMode}
          placeholder="What data is needed? (optional)"
          className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-lg text-text-primary placeholder-text-muted text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-accent font-mono resize-none"
          style={{ overflow: 'hidden' }}
        />
      </div>
    );
  }

  // View mode - show formatted content
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-text-muted">Test Data</label>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-xs text-accent hover:text-accent/80 flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
      </div>
      {/* Show code block if code detected, otherwise show as plain text */}
      {isCode ? (
        <CodeBlock code={value} />
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="px-3 py-2 bg-sidebar/50 border border-border rounded-lg text-text-primary text-sm font-mono whitespace-pre-wrap cursor-pointer hover:bg-sidebar/70 transition-colors"
        >
          {value || <span className="text-text-muted">Click to add test data...</span>}
        </div>
      )}
    </div>
  );
}
