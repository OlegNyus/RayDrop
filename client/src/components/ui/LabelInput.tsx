import { useState, useEffect, useRef } from 'react';
import { fetchLabels, saveLabels } from '../../services/api';

interface LabelInputProps {
  labels: string[];
  onChange: (labels: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function LabelInput({
  labels,
  onChange,
  placeholder = 'Search or create...',
  disabled = false,
}: LabelInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load labels from server
  useEffect(() => {
    async function loadLabels() {
      try {
        const result = await fetchLabels();
        if (result.success) {
          setAvailableLabels(result.labels || []);
        }
      } catch (e) {
        console.error('Failed to load labels:', e);
      }
    }
    loadLabels();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlight when dropdown opens or options change
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(-1);
    }
  }, [isOpen, inputValue]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-option]');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  function closeDropdown() {
    setIsOpen(false);
    setInputValue('');
    setHighlightedIndex(-1);
  }

  function openDropdown() {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // Filter labels based on input (exclude already selected)
  const filteredLabels = availableLabels.filter(
    (label) =>
      !labels.includes(label) &&
      label.toLowerCase().includes(inputValue.toLowerCase())
  );

  // Check if we should show "Create" option (case-sensitive check)
  const trimmedInput = inputValue.trim();
  const canCreate = trimmedInput && !availableLabels.includes(trimmedInput);
  const totalOptions = filteredLabels.length + (canCreate ? 1 : 0);

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        break;

      case 'Tab':
        closeDropdown();
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) =>
            prev < totalOptions - 1 ? prev + 1 : prev
          );
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredLabels.length) {
          selectLabel(filteredLabels[highlightedIndex]);
        } else if (highlightedIndex === filteredLabels.length && canCreate) {
          addLabel(inputValue);
        } else if (trimmedInput) {
          addLabel(inputValue);
        } else if (filteredLabels.length > 0) {
          selectLabel(filteredLabels[0]);
        }
        break;

      case 'Backspace':
        if (!inputValue && labels.length > 0) {
          onChange(labels.slice(0, -1));
        }
        break;

      case 'Home':
        if (isOpen && totalOptions > 0) {
          e.preventDefault();
          setHighlightedIndex(0);
        }
        break;

      case 'End':
        if (isOpen && totalOptions > 0) {
          e.preventDefault();
          setHighlightedIndex(totalOptions - 1);
        }
        break;
    }
  }

  async function addLabel(value: string) {
    const trimmed = value.trim();
    if (trimmed && !labels.includes(trimmed)) {
      onChange([...labels, trimmed]);
      // Add to available labels if not exists (case-sensitive)
      if (!availableLabels.includes(trimmed)) {
        const updated = [...availableLabels, trimmed].sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        setAvailableLabels(updated);
        try {
          await saveLabels(updated);
        } catch (e) {
          console.error('Failed to save labels:', e);
        }
      }
    }
    setInputValue('');
    // Keep dropdown open for adding more labels
    inputRef.current?.focus();
  }

  function selectLabel(label: string) {
    if (!labels.includes(label)) {
      onChange([...labels, label]);
    }
    setInputValue('');
    // Keep dropdown open for adding more labels
    inputRef.current?.focus();
  }

  function removeLabel(index: number, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(labels.filter((_, i) => i !== index));
  }

  async function removeFromAvailable(label: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = availableLabels.filter((l) => l !== label);
    setAvailableLabels(updated);
    try {
      await saveLabels(updated);
    } catch (e) {
      console.error('Failed to save labels:', e);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Main input field */}
      <div
        className={`min-h-[42px] h-auto flex items-center gap-2 px-3 py-2 bg-input-bg border rounded-lg ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-text'
        } ${isOpen ? 'ring-2 ring-accent border-transparent' : 'border-input-border'}`}
        onClick={openDropdown}
      >
        {/* Selected labels */}
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {labels.map((label, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-sm rounded-md bg-accent/10 text-accent"
              >
                {label}
                {!disabled && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => removeLabel(index, e)}
                    className="ml-0.5 hover:text-accent/70"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Input or placeholder */}
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or create..."
            className="flex-1 min-w-[120px] outline-none bg-transparent text-sm text-text-primary placeholder-text-muted"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            autoFocus
          />
        ) : labels.length === 0 ? (
          <span className="text-text-muted text-sm flex-1">{placeholder}</span>
        ) : (
          <span className="flex-1" />
        )}

        {/* Dropdown chevron */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={`text-text-muted flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-auto"
          role="listbox"
        >
          {/* Create new option */}
          {canCreate && (
            <div
              data-option
              onClick={() => addLabel(inputValue)}
              onMouseEnter={() => setHighlightedIndex(filteredLabels.length)}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-border text-accent ${
                highlightedIndex === filteredLabels.length
                  ? 'bg-accent/10'
                  : 'hover:bg-accent/5'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span className="flex-1">
                Create "<span className="font-medium">{trimmedInput}</span>"
              </span>
            </div>
          )}

          {filteredLabels.length > 0 ? (
            <div className="py-1">
              {filteredLabels.map((label, index) => (
                <div
                  key={label}
                  data-option
                  onClick={() => selectLabel(label)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer group ${
                    highlightedIndex === index
                      ? 'bg-accent/10'
                      : 'hover:bg-sidebar-hover'
                  }`}
                  role="option"
                  aria-selected={highlightedIndex === index}
                >
                  <span className="text-text-primary">{label}</span>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => removeFromAvailable(label, e)}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-error transition-opacity"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : !canCreate ? (
            <div className="p-3 text-center text-text-muted text-sm">
              {inputValue ? 'No labels found' : 'No labels available'}
            </div>
          ) : null}

          {/* Hint to create when list is shown but nothing typed */}
          {!inputValue && filteredLabels.length > 0 && (
            <div className="px-3 py-2 text-xs text-text-muted border-t border-border">
              Type to create a new label
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LabelInput;
