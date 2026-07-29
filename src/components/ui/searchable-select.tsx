'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronsUpDown, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export function SearchableSelect({ 
  options, 
  value, 
  onSelect, 
  placeholder, 
  label,
  className
}: { 
  options: string[], 
  value: string, 
  onSelect: (val: string) => void, 
  placeholder: string,
  label: string,
  className?: string
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  
  const filtered = useMemo(() => 
    options.filter(opt => opt.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  // Close the dropdown when clicking outside of it
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    if (open) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full h-12 rounded-2xl border-2 font-black text-slate-900 bg-white hover:bg-slate-50 px-5 border-slate-200 text-base sm:text-lg flex items-center justify-between transition-all outline-none focus:border-primary",
          className
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-5 w-5 shrink-0 opacity-50 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-2 p-0 rounded-2xl shadow-2xl border-2 border-slate-100 bg-white overflow-hidden z-[150] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 border-b bg-slate-50">
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
               <Input 
                 placeholder={`${label} શોધો...`} 
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="h-12 pl-10 rounded-xl border-2 bg-white font-black text-slate-900 text-base"
                 autoFocus
               />
             </div>
          </div>
          <ScrollArea className="h-64">
            <div className="p-1.5">
              {filtered.length === 0 && (
                <p className="p-4 text-center text-sm font-black text-slate-400 italic">કોઈ વિકલ્પ મળ્યો નથી.</p>
              )}
              {filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onSelect(opt);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl text-base font-black transition-all flex items-center justify-between",
                    value === opt ? "bg-primary/10 text-primary" : "hover:bg-slate-50 text-slate-900"
                  )}
                >
                  {opt}
                  {value === opt && <Check className="h-5 w-5" />}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
