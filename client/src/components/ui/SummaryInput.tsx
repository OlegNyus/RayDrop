import { useState, useRef, useEffect } from 'react';

interface SummaryInputProps {
  value: string;
  onChange: (value: string) => void;
  functionalAreas: string[];
  onAreasChange?: (areas: string[]) => void;
  error?: string;
}

export function SummaryInput({
  value,
  onChange,
  functionalAreas,
  onAreasChange,
  error,
}: SummaryInputProps) {
  // Parse current value
  const parts = value.split(' | ');
  const [area, setArea] = useState(parts.length >= 1 ? parts[0] : '');
  const [layer, setLayer] = useState<'UI' | 'API'>(
    parts.length >= 2 && parts[1] === 'API' ? 'API' : 'UI'
  );
  const [title, setTitle] = useState(parts.length >= 3 ? parts[2] : parts.length === 1 ? parts[0] : '');

  const [areaSearch, setAreaSearch] = useState('');
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const areaInputRef = useRef<HTMLInputElement>(null);

  // Build summary from parts
  const buildSummary = (a: string, l: string, t: string) => {
    if (!a && !t) return '';
    if (!a) return t;
    if (!t) return `${a} | ${l}`;
    return `${a} | ${l} | ${t}`;
  };

  // Update parent when parts change
  useEffect(() => {
    const newSummary = buildSummary(area, layer, title);
    if (newSummary !== value) {
      onChange(newSummary);
    }
  }, [area, layer, title]);

  // Parse incoming value changes
  useEffect(() => {
    const parts = value.split(' | ');
    if (parts.length === 3) {
      setArea(parts[0]);
      setLayer(parts[1] === 'API' ? 'API' : 'UI');
      setTitle(parts[2]);
    } else if (parts.length === 2) {
      setArea(parts[0]);
      setLayer(parts[1] === 'API' ? 'API' : 'UI');
      setTitle('');
    } else if (parts.length === 1 && parts[0]) {
      // Check if it's a known area
      if (functionalAreas.includes(parts[0])) {
        setArea(parts[0]);
        setTitle('');
      } else {
        setTitle(parts[0]);
      }
    }
  }, [value, functionalAreas]);

  const filteredAreas = functionalAreas.filter(a =>
    a.toLowerCase().includes(areaSearch.toLowerCase())
  );

  const selectArea = (a: string) => {
    setArea(a);
    setAreaSearch('');
    setShowAreaDropdown(false);
  };

  const createArea = () => {
    if (areaSearch.trim() && !functionalAreas.includes(areaSearch.trim())) {
      const newArea = areaSearch.trim();
      onAreasChange?.([...functionalAreas, newArea]);
      selectArea(newArea);
    }
  };

  const deleteArea = (areaToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onAreasChange?.(functionalAreas.filter(a => a !== areaToDelete));
    if (area === areaToDelete) {
      setArea('');
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-text-primary">
        Summary <span className="text-error">*</span>
      </label>

      <div className="grid grid-cols-12 gap-2">
        {/* Functional Area */}
        <div className="col-span-5 relative">
          <label className="block text-xs text-text-muted mb-1">Functional Area</label>
          <input
            ref={areaInputRef}
            type="text"
            value={showAreaDropdown ? areaSearch : area}
            onChange={e => {
              setAreaSearch(e.target.value);
              setShowAreaDropdown(true);
            }}
            onFocus={() => {
              setAreaSearch(area);
              setShowAreaDropdown(true);
            }}
            onBlur={() => setTimeout(() => setShowAreaDropdown(false), 200)}
            placeholder="Select or create..."
            className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />

          {showAreaDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredAreas.map(a => (
                <div
                  key={a}
                  onMouseDown={() => selectArea(a)}
                  className="flex items-center justify-between px-3 py-2 hover:bg-sidebar-hover cursor-pointer group"
                >
                  <span className="text-sm text-text-primary">{a}</span>
                  <button
                    type="button"
                    onMouseDown={e => deleteArea(a, e)}
                    className="text-text-muted hover:text-error opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
              {areaSearch && !functionalAreas.includes(areaSearch) && (
                <div
                  onMouseDown={createArea}
                  className="px-3 py-2 hover:bg-sidebar-hover cursor-pointer border-t border-border"
                >
                  <span className="text-sm text-accent">+ Create "{areaSearch}"</span>
                </div>
              )}
              {filteredAreas.length === 0 && !areaSearch && (
                <div className="px-3 py-2 text-sm text-text-muted">
                  Type to create a new area
                </div>
              )}
            </div>
          )}
        </div>

        {/* Layer Toggle */}
        <div className="col-span-2">
          <label className="block text-xs text-text-muted mb-1">Layer</label>
          <div className="flex rounded-lg overflow-hidden border border-input-border">
            <button
              type="button"
              onClick={() => setLayer('UI')}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                layer === 'UI'
                  ? 'bg-accent text-white'
                  : 'bg-input-bg text-text-secondary hover:bg-sidebar-hover'
              }`}
            >
              UI
            </button>
            <button
              type="button"
              onClick={() => setLayer('API')}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                layer === 'API'
                  ? 'bg-accent text-white'
                  : 'bg-input-bg text-text-secondary hover:bg-sidebar-hover'
              }`}
            >
              API
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="col-span-5">
          <label className="block text-xs text-text-muted mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Test case title..."
            className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="px-3 py-2 bg-sidebar rounded-lg">
        <span className="text-xs text-text-muted">Preview: </span>
        <span className="text-sm text-text-primary font-medium">
          {buildSummary(area, layer, title) || '(empty)'}
        </span>
      </div>

      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
