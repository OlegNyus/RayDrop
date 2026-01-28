import { useState, useRef, useEffect } from 'react';

interface SummaryInputProps {
  value: string;
  onChange: (value: string) => void;
  functionalAreas: string[];
  onAreasChange?: (areas: string[]) => void;
  error?: string;
  disabled?: boolean;
}

export function SummaryInput({
  value,
  onChange,
  functionalAreas,
  onAreasChange,
  error,
  disabled = false,
}: SummaryInputProps) {
  const [functionalArea, setFunctionalArea] = useState('');
  const [layer, setLayer] = useState<'UI' | 'API'>('UI');
  const [title, setTitle] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [initialized, setInitialized] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Parse existing value on mount or when value changes externally
  useEffect(() => {
    if (initialized && value === buildSummary(functionalArea, layer, title)) {
      return; // Skip if value matches current state
    }

    const parts = value.split(' | ');
    if (parts.length === 3) {
      setFunctionalArea(parts[0]);
      setLayer(parts[1] === 'API' ? 'API' : 'UI');
      setTitle(parts[2]);
    } else if (parts.length === 2) {
      setFunctionalArea(parts[0]);
      setLayer(parts[1] === 'API' ? 'API' : 'UI');
      setTitle('');
    } else if (parts.length === 1 && value.trim()) {
      if (functionalAreas.includes(value.trim())) {
        setFunctionalArea(value.trim());
        setTitle('');
      } else {
        setTitle(value);
        setFunctionalArea('');
      }
      setLayer('UI');
    } else if (!value) {
      setFunctionalArea('');
      setLayer('UI');
      setTitle('');
    }
    setInitialized(true);
  }, [value, functionalAreas]);

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

  // Filter areas based on input
  const filteredAreas = functionalAreas.filter((area) =>
    area.toLowerCase().includes(inputValue.toLowerCase())
  );

  // Check if we can create a new area
  const trimmedInput = inputValue.trim();
  const canCreate = trimmedInput && !functionalAreas.some(a => a.toLowerCase() === trimmedInput.toLowerCase());
  const totalOptions = filteredAreas.length + (canCreate ? 1 : 0);

  function buildSummary(area: string, lyr: string, ttl: string) {
    if (!area && !ttl) return '';
    if (!area) return ttl;
    if (!ttl) return `${area} | ${lyr}`;
    return `${area} | ${lyr} | ${ttl}`;
  }

  function handleAreaSelect(area: string) {
    setFunctionalArea(area);
    closeDropdown();
    onChange(buildSummary(area, layer, title));
  }

  function handleCreateArea() {
    if (!canCreate) return;
    const newArea = trimmedInput;
    const updated = [...functionalAreas, newArea].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    onAreasChange?.(updated);
    setFunctionalArea(newArea);
    closeDropdown();
    onChange(buildSummary(newArea, layer, title));
  }

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
        if (highlightedIndex >= 0 && highlightedIndex < filteredAreas.length) {
          handleAreaSelect(filteredAreas[highlightedIndex]);
        } else if (canCreate) {
          handleCreateArea();
        } else if (filteredAreas.length > 0) {
          handleAreaSelect(filteredAreas[0]);
        }
        break;

      case 'Backspace':
        if (!inputValue && functionalArea) {
          setFunctionalArea('');
          onChange(buildSummary('', layer, title));
        }
        break;
    }
  }

  function handleLayerChange(lyr: 'UI' | 'API') {
    if (disabled) return;
    setLayer(lyr);
    onChange(buildSummary(functionalArea, lyr, title));
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newTitle = e.target.value;
    setTitle(newTitle);
    onChange(buildSummary(functionalArea, layer, newTitle));
  }

  function handleRemoveArea(area: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = functionalAreas.filter((a) => a !== area);
    onAreasChange?.(updated);
    if (functionalArea === area) {
      setFunctionalArea('');
      onChange(buildSummary('', layer, title));
    }
  }

  function clearSelection(e: React.MouseEvent) {
    e.stopPropagation();
    setFunctionalArea('');
    onChange(buildSummary('', layer, title));
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-text-primary">
        Summary <span className="text-error">*</span>
      </label>

      {/* Preview */}
      {(functionalArea || title) && (
        <div className="px-3 py-2 bg-sidebar rounded-lg">
          <span className="text-xs text-text-muted">Preview: </span>
          <span className="text-sm text-text-primary font-medium font-mono">
            {buildSummary(functionalArea, layer, title) || '(empty)'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-12 gap-2">
        {/* Functional Area - 5 cols */}
        <div className="col-span-5 relative" ref={containerRef}>
          <label className="block text-xs text-text-muted mb-1">
            Functional Area
          </label>
          {/* Main input field */}
          <div
            className={`min-h-[42px] h-auto flex items-center gap-2 px-3 py-2 bg-input-bg border rounded-lg ${
              disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-text'
            } ${isOpen ? 'ring-2 ring-accent border-transparent' : 'border-input-border'} ${
              error && !functionalArea ? 'border-error' : ''
            }`}
            onClick={openDropdown}
          >
            {functionalArea && !isOpen ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 text-sm rounded-md bg-sidebar">
                  <span className="text-text-primary">{functionalArea}</span>
                  {!disabled && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={clearSelection}
                      className="ml-0.5 text-text-muted hover:text-text-secondary"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </span>
                <span className="flex-1" />
              </>
            ) : isOpen ? (
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search or create..."
                className="flex-1 outline-none bg-transparent text-sm text-text-primary placeholder-text-muted"
                autoFocus
              />
            ) : (
              <span className="text-text-muted text-sm flex-1">Search or create...</span>
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
                  onClick={handleCreateArea}
                  onMouseEnter={() => setHighlightedIndex(filteredAreas.length)}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-border text-accent ${
                    highlightedIndex === filteredAreas.length
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

              {filteredAreas.length > 0 ? (
                <div className="py-1">
                  {filteredAreas.map((area, index) => (
                    <div
                      key={area}
                      data-option
                      onClick={() => handleAreaSelect(area)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`flex items-center justify-between px-3 py-2 cursor-pointer group ${
                        highlightedIndex === index
                          ? 'bg-accent/10'
                          : functionalArea === area
                          ? 'bg-sidebar'
                          : 'hover:bg-sidebar-hover'
                      }`}
                      role="option"
                      aria-selected={highlightedIndex === index}
                    >
                      <span className="text-text-primary">{area}</span>
                      <div className="flex items-center gap-2">
                        {functionalArea === area && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-accent flex-shrink-0">
                            <path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => handleRemoveArea(area, e)}
                          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-error transition-opacity"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !canCreate ? (
                <div className="p-3 text-center text-text-muted text-sm">
                  {inputValue ? 'No areas found' : 'No areas available'}
                </div>
              ) : null}

              {/* Hint to create when list is shown but nothing typed */}
              {!inputValue && filteredAreas.length > 0 && (
                <div className="px-3 py-2 text-xs text-text-muted border-t border-border">
                  Type to create a new area
                </div>
              )}
            </div>
          )}
        </div>

        {/* Layer Toggle - 2 cols */}
        <div className="col-span-2">
          <label className="block text-xs text-text-muted mb-1">
            Layer
          </label>
          <div className={`flex rounded-lg overflow-hidden border border-input-border h-[42px] ${disabled ? 'opacity-60' : ''}`}>
            <button
              type="button"
              onClick={() => handleLayerChange('UI')}
              disabled={disabled}
              className={`flex-1 text-sm font-medium transition-colors ${disabled ? 'cursor-not-allowed' : ''} ${
                layer === 'UI'
                  ? 'bg-accent text-white'
                  : 'bg-input-bg text-text-secondary hover:bg-sidebar-hover'
              }`}
            >
              UI
            </button>
            <button
              type="button"
              onClick={() => handleLayerChange('API')}
              disabled={disabled}
              className={`flex-1 text-sm font-medium transition-colors ${disabled ? 'cursor-not-allowed' : ''} ${
                layer === 'API'
                  ? 'bg-blue-500 text-white'
                  : 'bg-input-bg text-text-secondary hover:bg-sidebar-hover'
              }`}
            >
              API
            </button>
          </div>
        </div>

        {/* Title - 5 cols */}
        <div className="col-span-5">
          <label className="block text-xs text-text-muted mb-1">
            Title <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Test case title"
            disabled={disabled}
            className={`w-full h-[42px] px-3 py-2 bg-input-bg border border-input-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent ${
              error && !title ? 'border-error' : ''
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          />
        </div>
      </div>

      {error && !functionalArea && !title && (
        <p className="text-xs text-error">{error}</p>
      )}
    </div>
  );
}

export default SummaryInput;
