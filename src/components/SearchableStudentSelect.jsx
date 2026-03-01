/**
 * SearchableStudentSelect.jsx
 * src/components/SearchableStudentSelect.jsx
 *
 * Drop-in replacement for any <Select> used to pick a student.
 * Features:
 *  - Scrollable list (max-height with overflow-y scroll)
 *  - Live search/filter by name OR matricule
 *  - Keyboard-accessible
 *  - Shows count footer
 *  - Works in both light and dark themes
 *
 * Props:
 *  students    {matricule, name}[]  — list of students
 *  value       string              — currently selected matricule
 *  onChange    (matricule) => void
 *  disabled    boolean
 *  loading     boolean             — shows spinner while fetching
 *  placeholder string
 */
import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const SearchableStudentSelect = ({
  students = [],
  value = '',
  onChange,
  disabled = false,
  loading = false,
  placeholder = 'Select student…',
}) => {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef  = useRef(null);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  const selected = students.find(s => s.matricule === value);

  const filtered = query.trim()
    ? students.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.matricule.toLowerCase().includes(query.toLowerCase())
      )
    : students;

  // Close when clicking outside
  useEffect(() => {
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  const toggle = () => {
    if (disabled || loading) return;
    setOpen(o => !o);
    if (open) setQuery('');
  };

  const pick = (matricule) => {
    onChange(matricule);
    setOpen(false);
    setQuery('');
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* ── Trigger ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || loading}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm',
          'bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open ? 'border-ring ring-2 ring-ring ring-offset-0' : 'border-input hover:border-muted-foreground/50'
        )}
      >
        {/* Label */}
        <span className={cn('truncate text-left', !selected && 'text-muted-foreground')}>
          {loading ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading students…
            </span>
          ) : selected ? (
            <span className="flex items-center gap-2">
              <span className="font-medium">{selected.name}</span>
              <span className="text-xs text-muted-foreground font-mono">{selected.matricule}</span>
            </span>
          ) : placeholder}
        </span>

        {/* Clear + chevron */}
        <span className="flex items-center gap-1 shrink-0 ml-2">
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={clear}
              onKeyDown={e => e.key === 'Enter' && clear(e)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )} />
        </span>
      </button>

      {/* ── Dropdown panel ───────────────────────────────────────── */}
      {open && !loading && (
        <div className={cn(
          'absolute z-50 mt-1 w-full rounded-md border border-border shadow-lg',
          'bg-popover text-popover-foreground',
          'animate-in fade-in-0 zoom-in-95 duration-100'
        )}>
          {/* Search bar */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 bg-muted/30 rounded-t-md">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or matricule…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')}>
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Scrollable list */}
          <div ref={listRef} className="max-h-56 overflow-y-auto overscroll-contain py-1">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No student found for "{query}"
              </p>
            ) : (
              filtered.map(s => (
                <button
                  key={s.matricule}
                  type="button"
                  onClick={() => pick(s.matricule)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-sm text-left',
                    'transition-colors cursor-pointer',
                    s.matricule === value
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <span className="truncate">{s.name}</span>
                  <span className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-xs text-muted-foreground font-mono">{s.matricule}</span>
                    {s.matricule === value && <Check className="w-3.5 h-3.5 text-primary" />}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Footer count */}
          <div className="border-t border-border px-3 py-1.5 bg-muted/20 rounded-b-md">
            <p className="text-[11px] text-muted-foreground">
              {query
                ? `${filtered.length} match${filtered.length !== 1 ? 'es' : ''} out of ${students.length}`
                : `${students.length} student${students.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableStudentSelect;
