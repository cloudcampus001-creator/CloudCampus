/**
 * SearchableSelect.jsx
 * src/components/SearchableSelect.jsx
 *
 * Generic searchable, scrollable dropdown — works for schools, teachers,
 * subjects, students, or any list. A superset of SearchableStudentSelect.
 *
 * Props:
 *   items        { value: string, label: string, sub?: string, icon?: ReactNode }[]
 *   value        string   — currently selected value
 *   onChange     (value: string) => void
 *   placeholder  string
 *   searchPlaceholder string
 *   disabled     boolean
 *   loading      boolean
 *   className    string   — extra classes on the trigger button
 *   triggerClassName string
 */
import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const SearchableSelect = ({
  items = [],
  value = '',
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  disabled = false,
  loading = false,
  className = '',
  triggerClassName = '',
}) => {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef  = useRef(null);
  const inputRef = useRef(null);

  const selected = items.find(i => i.value === value);

  const filtered = query.trim()
    ? items.filter(i =>
        i.label.toLowerCase().includes(query.toLowerCase()) ||
        (i.sub && i.sub.toLowerCase().includes(query.toLowerCase()))
      )
    : items;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  const toggle = () => {
    if (disabled || loading) return;
    setOpen(o => !o);
    if (open) setQuery('');
  };

  const pick = (val) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={wrapRef} className={cn('relative w-full', className)}>
      {/* ── Trigger ────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || loading}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm',
          'bg-background transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open
            ? 'border-ring ring-2 ring-ring ring-offset-0'
            : 'border-input hover:border-muted-foreground/50',
          triggerClassName
        )}
      >
        <span className={cn('truncate text-left flex items-center gap-2', !selected && 'text-muted-foreground')}>
          {loading ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </span>
          ) : selected ? (
            <>
              {selected.icon && <span className="shrink-0">{selected.icon}</span>}
              <span className="font-medium">{selected.label}</span>
              {selected.sub && <span className="text-xs text-muted-foreground">{selected.sub}</span>}
            </>
          ) : placeholder}
        </span>

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

      {/* ── Dropdown panel ─────────────────────────────────────── */}
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
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')}>
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Scrollable list */}
          <div className="max-h-56 overflow-y-auto overscroll-contain py-1">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No results for "{query}"
              </p>
            ) : (
              filtered.map(item => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => pick(item.value)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-sm text-left',
                    'transition-colors cursor-pointer',
                    item.value === value
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    {item.icon && <span className="shrink-0 text-muted-foreground">{item.icon}</span>}
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0 ml-3">
                    {item.sub && (
                      <span className="text-xs text-muted-foreground font-mono">{item.sub}</span>
                    )}
                    {item.value === value && <Check className="w-3.5 h-3.5 text-primary" />}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Footer count */}
          <div className="border-t border-border px-3 py-1.5 bg-muted/20 rounded-b-md">
            <p className="text-[11px] text-muted-foreground">
              {query
                ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} of ${items.length}`
                : `${items.length} item${items.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
