import { useState, useRef, useEffect, type ReactNode } from "react";
import { Search, X, Filter, ChevronDown, Check, SlidersHorizontal } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export type FilterOp = "contains" | "exact" | "startswith";

export interface FilterField {
  key: string;
  label: string;
  type: "text" | "select" | "multiselect" | "daterange";
  options?: { value: string; label?: string }[];
}

export interface FilterState {
  q: string;
  filters: Record<string, string | string[]>;
}

export function emptyFilterState(): FilterState {
  return { q: "", filters: {} };
}

export function hasActiveFilters(s: FilterState): boolean {
  if (s.q) return true;
  return Object.values(s.filters).some((v) => (Array.isArray(v) ? v.length > 0 : !!v));
}

// ── MultiSelect dropdown ───────────────────────────────────────────────────────

function MultiSelectDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label?: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: Math.max(r.width, 180) });
    }
    setOpen((o) => !o);
    setSearch("");
  }

  const filteredOptions = search
    ? options.filter(o => (o.label ?? o.value).toLowerCase().includes(search.toLowerCase()))
    : options;

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  const active = value.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-ring whitespace-nowrap ${
          active
            ? "bg-primary/10 border-primary/40 text-primary font-medium"
            : "bg-background border-border text-muted-foreground hover:border-muted-foreground/50"
        }`}
      >
        {label}
        {active && (
          <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0 text-[10px] font-bold leading-4">
            {value.length}
          </span>
        )}
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-background border border-border rounded-md shadow-lg py-1 max-h-72 overflow-hidden flex flex-col"
        >
          {options.length > 6 && (
            <div className="px-2 pt-1 pb-1.5 border-b border-border">
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="w-full px-2 py-1 text-xs bg-muted/50 border border-border rounded"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
          <div className="overflow-y-auto">
            {filteredOptions.map((o) => {
              const sel = value.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted transition-colors text-left ${sel ? "text-primary font-medium" : "text-foreground"}`}
                >
                  {o.label ?? o.value}
                  {sel && <Check className="size-3 text-primary shrink-0" />}
                </button>
              );
            })}
            {filteredOptions.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No options</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single select dropdown ─────────────────────────────────────────────────────

function SingleSelectDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: Math.max(r.width, 160) });
    }
    setOpen((o) => !o);
  }

  const selected = options.find((o) => o.value === value);
  const active = !!value;

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-ring whitespace-nowrap ${
          active
            ? "bg-primary/10 border-primary/40 text-primary font-medium"
            : "bg-background border-border text-muted-foreground hover:border-muted-foreground/50"
        }`}
      >
        {active ? (selected?.label ?? selected?.value ?? label) : label}
        {active && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="ml-0.5 hover:text-red-500"
          >
            <X className="size-3" />
          </button>
        )}
        {!active && <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && (
        <div
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-background border border-border rounded-md shadow-lg py-1 max-h-56 overflow-y-auto"
        >
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="w-full flex items-center px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted text-left"
            >
              — clear —
            </button>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted transition-colors text-left ${value === o.value ? "text-primary font-medium" : "text-foreground"}`}
            >
              {o.label ?? o.value}
              {value === o.value && <Check className="size-3 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Active filter chips ────────────────────────────────────────────────────────

function FilterChips({
  fields,
  state,
  onChange,
}: {
  fields: FilterField[];
  state: FilterState;
  onChange: (s: FilterState) => void;
}) {
  const chips: { key: string; label: string; value: string }[] = [];

  for (const [k, v] of Object.entries(state.filters)) {
    const field = fields.find((f) => f.key === k);
    if (!field) continue;
    if (Array.isArray(v)) {
      v.forEach((val) => chips.push({ key: k, label: field.label, value: val }));
    } else if (v) {
      chips.push({ key: k, label: field.label, value: v });
    }
  }

  if (chips.length === 0) return null;

  function remove(key: string, value: string) {
    const cur = state.filters[key];
    if (Array.isArray(cur)) {
      const next = cur.filter((v) => v !== value);
      onChange({ ...state, filters: { ...state.filters, [key]: next } });
    } else {
      const { [key]: _, ...rest } = state.filters;
      onChange({ ...state, filters: rest });
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {chips.map(({ key, label, value }) => (
        <span
          key={`${key}:${value}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-primary/8 border border-primary/20 text-primary rounded-full font-medium"
        >
          <span className="text-primary/60">{label}:</span> {value}
          <button
            type="button"
            onClick={() => remove(key, value)}
            className="ml-0.5 hover:text-red-500 transition-colors"
          >
            <X className="size-2.5" />
          </button>
        </span>
      ))}
    </div>
  );
}

// ── Main AdvancedFilter bar ────────────────────────────────────────────────────

export function AdvancedFilter({
  fields,
  state,
  onChange,
  searchPlaceholder = "Search…",
  extra,
}: {
  fields: FilterField[];
  state: FilterState;
  onChange: (s: FilterState) => void;
  searchPlaceholder?: string;
  extra?: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const active = hasActiveFilters(state);

  function setQ(q: string) { onChange({ ...state, q }); }

  function setFilter(key: string, value: string | string[]) {
    onChange({ ...state, filters: { ...state.filters, [key]: value } });
  }

  function reset() { onChange(emptyFilterState()); }

  function renderField(f: FilterField) {
    if (f.type === "select") {
      return (
        <SingleSelectDropdown
          key={f.key}
          label={f.label}
          options={f.options ?? []}
          value={(state.filters[f.key] as string) ?? ""}
          onChange={(v) => setFilter(f.key, v)}
        />
      );
    }
    if (f.type === "multiselect") {
      return (
        <MultiSelectDropdown
          key={f.key}
          label={f.label}
          options={f.options ?? []}
          value={(state.filters[f.key] as string[]) ?? []}
          onChange={(v) => setFilter(f.key, v)}
        />
      );
    }
    if (f.type === "text") {
      const val = (state.filters[f.key] as string) ?? "";
      return (
        <div key={f.key} className="relative">
          <input
            value={val}
            onChange={(e) => setFilter(f.key, e.target.value)}
            placeholder={f.label}
            className={`px-2.5 py-1.5 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring w-32 transition-colors ${val ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}`}
          />
          {val && (
            <button
              type="button"
              onClick={() => setFilter(f.key, "")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 hover:text-red-500"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      );
    }
    return null;
  }

  const chips = <FilterChips fields={fields} state={state} onChange={onChange} />;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            value={state.q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {state.q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-red-500"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Fields — desktop */}
        <div className="hidden md:flex flex-wrap gap-1.5 items-center">
          {fields.map(renderField)}
        </div>

        {/* Mobile drawer toggle */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={`md:hidden flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-md transition-colors ${active ? "border-primary/40 text-primary bg-primary/10" : "border-border text-muted-foreground"}`}
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {active && <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-bold leading-4">!</span>}
        </button>

        {extra}

        {active && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground border border-border rounded-md hover:bg-muted transition-colors"
          >
            <X className="size-3" /> Reset
          </button>
        )}
      </div>

      {chips}

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border rounded-t-xl p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold flex items-center gap-1.5"><Filter className="size-4" />Filters</span>
              <button onClick={() => setDrawerOpen(false)}><X className="size-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {fields.map((f) => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{f.label}</label>
                  {renderField(f)}
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={reset} className="flex-1 py-2 text-sm border border-border rounded-md hover:bg-muted">Reset all</button>
              <button onClick={() => setDrawerOpen(false)} className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-md">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
