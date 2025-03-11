// src/app/(app)/calls/_components/calls-table-search.tsx
"use client";

import { Input } from "@/components/ui/input";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { Search as SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function CallsTableSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  // Separate input state from search state
  const [inputValue, setInputValue] = useState(
    searchParams.get("search") || "",
  );
  const [lastAppliedSearch, setLastAppliedSearch] = useState(
    searchParams.get("search") || "",
  );

  // Apply search by updating the URL
  const applySearch = useCallback(
    (searchValue: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (searchValue && searchValue.trim() !== "") {
        params.set("search", searchValue.trim());
      } else {
        params.delete("search");
      }

      // Track what search we actually applied
      setLastAppliedSearch(searchValue);

      // Push to router without replacing history
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Create debounced version of search
  const debouncedApplySearch = useDebouncedCallback(
    (value: string) => applySearch(value),
    600, // 600ms debounce delay
  );

  // Handle input changes without immediately applying search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    debouncedApplySearch(newValue);
  };

  // Apply search immediately on Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applySearch(inputValue);

      // Remove focus to indicate search has been applied
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }
  };

  // If the URL search param changes externally (e.g., from filter reset)
  useEffect(() => {
    const currentUrlSearch = searchParams.get("search") || "";

    // Only update if the change came from outside this component
    if (currentUrlSearch !== lastAppliedSearch) {
      setInputValue(currentUrlSearch);
      setLastAppliedSearch(currentUrlSearch);
    }
  }, [searchParams, lastAppliedSearch]);

  return (
    <div className="relative flex-1 lg:w-72">
      <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search by name or phone..."
        className="w-full pl-9"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // If input value doesn't match last applied search, apply it now
          if (inputValue !== lastAppliedSearch) {
            applySearch(inputValue);
          }
        }}
      />
    </div>
  );
}
