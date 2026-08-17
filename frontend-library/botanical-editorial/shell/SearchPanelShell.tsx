import type React from "react";
import { Search } from "lucide-react";

export type SearchPanelShellProps = {
  action: string;
  query?: string;
  placeholder?: string;
  buttonLabel?: React.ReactNode;
};

export function SearchPanelShell({
  action,
  query = "",
  placeholder = "Search",
  buttonLabel = "Search",
}: SearchPanelShellProps) {
  return (
    <form action={action} className="search-panel">
      <Search size={18} aria-hidden="true" />
      <input name="q" defaultValue={query} placeholder={placeholder} />
      <button className="button" type="submit">
        {buttonLabel}
      </button>
    </form>
  );
}
