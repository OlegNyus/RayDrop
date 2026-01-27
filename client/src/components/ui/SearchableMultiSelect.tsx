import { useState, useRef, useEffect } from 'react';
import type { XrayEntity } from '../../types';

interface SearchableMultiSelectProps {
  label: string;
  options: XrayEntity[];
  selectedIds: string[];
  selectedDisplays: { id: string; display: string }[];
  onChange: (ids: string[], displays: { id: string; display: string }[]) => void;
  placeholder?: string;
  loading?: boolean;
  required?: boolean;
  error?: string;
}

export function SearchableMultiSelect({
  label,
  options,
  selectedIds,
  selectedDisplays,
  onChange,
  placeholder = 'Search...',
  loading = false,
  required = false,
  error,
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options
    .filter(opt => !selectedIds.includes(opt.issueId))
    .filter(opt => {
      const searchLower = search.toLowerCase();
      return (
        opt.key.toLowerCase().includes(searchLower) ||
        opt.summary.toLowerCase().includes(searchLower)
      );
    })
    .slice(0, 50);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, isOpen]);

  const toggleOption = (opt: XrayEntity) => {
    if (selectedIds.includes(opt.issueId)) {
      onChange(
        selectedIds.filter(id => id !== opt.issueId),
        selectedDisplays.filter(d => d.id !== opt.issueId)
      );
    } else {
      onChange(
        [...selectedIds, opt.issueId],
        [...selectedDisplays, { id: opt.issueId, display: `${opt.key}: ${opt.summary}` }]
      );
    }
    setSearch('');
  };

  const removeSelected = (id: string) => {
    onChange(
      selectedIds.filter(i => i !== id),
      selectedDisplays.filter(d => d.id !== id)
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, filteredOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filteredOptions.length > 0) {
      e.preventDefault();
      toggleOption(filteredOptions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Backspace' && search === '' && selectedIds.length > 0) {
      removeSelected(selectedIds[selectedIds.length - 1]);
    }
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-text-primary">
        {label} {required && <span className="text-error">*</span>}
      </label>

      {/* Selected items */}
      {selectedDisplays.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedDisplays.map(item => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-accent/20 text-accent rounded text-xs"
            >
              <span className="max-w-[150px] truncate">{item.display.split(':')[0]}</span>
              <button
                type="button"
                onClick={() => removeSelected(item.id)}
                className="hover:text-error"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'Loading...' : placeholder}
          disabled={loading}
          className={`w-full px-3 py-2 bg-input-bg border rounded-lg text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent ${
            error ? 'border-error' : 'border-input-border'
          }`}
        />

        {/* Dropdown */}
        {isOpen && filteredOptions.length > 0 && (
          <div
            ref={listRef}
            className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {filteredOptions.map((opt, index) => (
              <button
                key={opt.issueId}
                type="button"
                onMouseDown={() => toggleOption(opt)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-sidebar-hover ${
                  index === highlightedIndex ? 'bg-sidebar-hover' : ''
                }`}
              >
                <span className="font-medium text-accent">{opt.key}</span>
                <span className="text-text-secondary ml-2 truncate">{opt.summary}</span>
              </button>
            ))}
          </div>
        )}

        {isOpen && filteredOptions.length === 0 && search && (
          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg p-3 text-sm text-text-muted">
            No matches found
          </div>
        )}
      </div>

      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
