import React, { useState, useRef, useEffect } from 'react';
import { MEDICINE_NAMES } from '../data/medicineNames';

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  hasError?: boolean;
}

export default function MedicineAutocomplete({ value, onChange, placeholder = 'e.g. Metformin', hasError }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const starts = MEDICINE_NAMES.filter(n => n.toLowerCase().startsWith(q));
    const contains = MEDICINE_NAMES.filter(n => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q));
    const results = [...starts, ...contains].slice(0, 6);
    setSuggestions(results);
    setOpen(results.length > 0);
    setHighlighted(-1);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      select(suggestions[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full p-4 bg-slate-50 border rounded-xl font-bold text-sm outline-none mt-1 focus:ring-2 focus:ring-blue-100 transition-all ${hasError ? 'border-red-300 bg-red-50' : 'border-slate-100'}`}
      />

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-top-2 duration-150">
          {suggestions.map((name, i) => {
            const q = value.trim().toLowerCase();
            const matchStart = name.toLowerCase().indexOf(q);
            const before = name.slice(0, matchStart);
            const match = name.slice(matchStart, matchStart + q.length);
            const after = name.slice(matchStart + q.length);

            return (
              <button
                key={name}
                onMouseDown={() => select(name)}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors border-b border-slate-50 last:border-0 flex items-center gap-2 ${highlighted === i ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <span className="text-base">💊</span>
                <span>
                  {before}
                  <span className="text-blue-600 bg-blue-50 rounded px-0.5">{match}</span>
                  {after}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
