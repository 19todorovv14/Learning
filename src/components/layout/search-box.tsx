import { Search } from "lucide-react";

export function SearchBox({ defaultValue = "", autoFocus = false, className = "" }: { defaultValue?: string; autoFocus?: boolean; className?: string }) {
  return (
    <form action="/search" method="get" role="search" className={`relative ${className}`}>
      <label htmlFor="global-search" className="sr-only">
        Търсене
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        id="global-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Търси урок, тема, определение… или „обясни ми фотосинтезата за 7. клас“"
        className="input h-10 rounded-full bg-surface-2 py-2 pl-9 pr-4 text-sm"
        maxLength={200}
      />
    </form>
  );
}
