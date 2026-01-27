import { useState, useRef } from 'react';

interface FolderOption {
  path: string;
  name: string;
}

interface FolderInputProps {
  value: string;
  onChange: (value: string) => void;
  folders: FolderOption[];
  loading?: boolean;
  required?: boolean;
  error?: string;
}

export function FolderInput({
  value,
  onChange,
  folders,
  loading = false,
  required = false,
  error,
}: FolderInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Always include root
  const allFolders: FolderOption[] = [
    { path: '/', name: '/ (Root)' },
    ...folders.filter(f => f.path !== '/'),
  ];

  const filteredFolders = allFolders.filter(f =>
    f.path.toLowerCase().includes(search.toLowerCase()) ||
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectFolder = (path: string) => {
    onChange(path);
    setIsEditing(false);
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, filteredFolders.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredFolders.length > 0) {
        selectFolder(filteredFolders[highlightedIndex].path);
      } else if (search.startsWith('/')) {
        // Allow custom path
        selectFolder(search);
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setSearch('');
    }
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-text-primary">
        Folder Path {required && <span className="text-error">*</span>}
      </label>

      {!isEditing ? (
        <button
          type="button"
          onClick={() => {
            setIsEditing(true);
            setSearch(value);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className={`w-full px-3 py-2 bg-input-bg border rounded-lg text-left text-sm flex items-center gap-2 hover:border-accent transition-colors ${
            error ? 'border-error' : 'border-input-border'
          }`}
        >
          <span className="text-text-muted">📁</span>
          <span className={value ? 'text-text-primary' : 'text-text-muted'}>
            {value || 'Select folder...'}
          </span>
        </button>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setHighlightedIndex(0);
            }}
            onBlur={() => setTimeout(() => {
              setIsEditing(false);
              setSearch('');
            }, 200)}
            onKeyDown={handleKeyDown}
            placeholder={loading ? 'Loading...' : 'Search or type path...'}
            disabled={loading}
            className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />

          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredFolders.map((folder, index) => (
              <button
                key={folder.path}
                type="button"
                onMouseDown={() => selectFolder(folder.path)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-sidebar-hover ${
                  index === highlightedIndex ? 'bg-sidebar-hover' : ''
                }`}
              >
                <span className="text-text-muted">📁</span>
                <span className="text-text-primary">{folder.path}</span>
              </button>
            ))}

            {search.startsWith('/') && !filteredFolders.some(f => f.path === search) && (
              <button
                type="button"
                onMouseDown={() => selectFolder(search)}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-sidebar-hover border-t border-border"
              >
                <span className="text-accent">+ Use custom path: "{search}"</span>
              </button>
            )}

            {filteredFolders.length === 0 && !search.startsWith('/') && (
              <div className="px-3 py-2 text-sm text-text-muted">
                Type a path starting with /
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
