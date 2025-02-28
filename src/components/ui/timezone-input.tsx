"use client";

// src/components/ui/timezone-input.tsx
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Common timezones with readable labels
export const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "America/Adak", label: "Hawaii-Aleutian Time (HAT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "Europe/London", label: "UK (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET)" },
];

interface TimeZoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function TimeZoneInput({
  value,
  onChange,
  placeholder = "Select timezone",
  className,
  disabled = false,
}: TimeZoneInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filteredTimezones, setFilteredTimezones] = useState(TIMEZONES);

  // Get the label for the current value
  const selectedTimezone = TIMEZONES.find((tz) => tz.value === value);

  // Filter timezones based on search
  useEffect(() => {
    if (search) {
      const normalizedSearch = search.toLowerCase();
      setFilteredTimezones(
        TIMEZONES.filter(
          (tz) =>
            tz.label.toLowerCase().includes(normalizedSearch) ||
            tz.value.toLowerCase().includes(normalizedSearch),
        ),
      );
    } else {
      setFilteredTimezones(TIMEZONES);
    }
  }, [search]);

  // Reset search when popover closes
  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedTimezone ? selectedTimezone.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Search timezones..."
              value={search}
              onValueChange={setSearch}
              className="flex-1"
            />
          </div>
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {filteredTimezones.map((tz) => (
                <CommandItem
                  key={tz.value}
                  value={tz.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === tz.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {tz.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
