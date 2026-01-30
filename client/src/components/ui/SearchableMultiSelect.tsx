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
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectOption = (opt: XrayEntity) => {
    onChange(
      [...selectedIds, opt.issueId],
      [...selectedDisplays, { id: opt.issueId, display: `${opt.key}: ${opt.summary}` }]
    );
    setSearch('');
    inputRef.current?.focus();
  };

  const removeSelected = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(
      selectedIds.filter(i => i !== id),
      selectedDisplays.filter(d => d.id !== id)
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex(i => Math.min(i + 1, filteredOptions.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filteredOptions.length > 0) {
      e.preventDefault();
      selectOption(filteredOptions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Backspace' && search === '' && selectedIds.length > 0) {
      removeSelected(selectedIds[selectedIds.length - 1]);
    }
  };

  const openDropdown = () => {
    if (loading) return;
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="space-y-1" ref={containerRef}>
      <label className="block text-sm font-medium text-text-primary">
        {label} {required && <span className="text-error">*</span>}
      </label>

      {/* Combined input field with tags inside */}
      <div className="relative">
        <div
          className={`min-h-[42px] flex items-center gap-2 px-3 py-2 bg-input-bg border rounded-lg cursor-text ${
            loading ? 'opacity-60 cursor-not-allowed' : ''
          } ${isOpen ? 'ring-2 ring-accent border-transparent' : error ? 'border-error' : 'border-input-border'}`}
          onClick={openDropdown}
          onKeyDown={(e) => {
            if (!isOpen && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              openDropdown();
            }
          }}
          tabIndex={loading || isOpen ? -1 : 0}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          {/* Selected items as tags */}
          {selectedDisplays.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedDisplays.map(item => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-sm rounded-md bg-accent/10 text-accent"
                >
                  <span className="max-w-[120px] truncate">{item.display.split(':')[0]}</span>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => removeSelected(item.id, e)}
                    className="ml-0.5 hover:text-accent/70"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input or placeholder */}
          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={loading ? 'Loading...' : 'Search...'}
              disabled={loading}
              className="flex-1 min-w-[100px] outline-none bg-transparent text-sm text-text-primary placeholder-text-muted"
              autoFocus
            />
          ) : selectedDisplays.length === 0 ? (
            <span className="text-text-muted text-sm flex-1">
              {loading ? 'Loading...' : placeholder}
            </span>
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
            className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, index) => (
                <button
                  key={opt.issueId}
                  type="button"
                  onMouseDown={() => selectOption(opt)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-sidebar-hover ${
                    index === highlightedIndex ? 'bg-sidebar-hover' : ''
                  }`}
                >
                  <span className="font-medium text-accent">{opt.key}</span>
                  <span className="text-text-secondary ml-2 truncate">{opt.summary}</span>
                </button>
              ))
            ) : search ? (
              <div className="p-3 text-center text-text-muted text-sm">
                No matches found
              </div>
            ) : (
              <div className="p-3 text-center text-text-muted text-sm">
                {options.length === 0 ? 'No options available' : 'All options selected'}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  );
}
