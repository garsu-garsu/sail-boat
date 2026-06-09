import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DEFAULT_FILTER, type Filter } from "../../types";

const STORAGE_KEY = "sailboat.filter";

function loadFilter(): Filter {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_FILTER, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_FILTER;
}

interface FilterContextValue {
  filter: Filter;
  setFilter: (filter: Filter) => void;
  reset: () => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<Filter>(loadFilter);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filter));
    } catch {
      /* ignore */
    }
  }, [filter]);

  const setFilter = useCallback((f: Filter) => setFilterState(f), []);
  const reset = useCallback(() => setFilterState(DEFAULT_FILTER), []);

  const value = useMemo(
    () => ({ filter, setFilter, reset }),
    [filter, setFilter, reset],
  );
  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
}

export function useFilter(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (ctx == null) {
    throw new Error("useFilter must be used within FilterProvider");
  }
  return ctx;
}
