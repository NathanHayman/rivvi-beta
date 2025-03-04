"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import * as React from "react";

interface AccessibleTagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label: string;
}

export function AccessibleTagInput({
  value = [],
  onChange,
  placeholder = "Add tag...",
  label,
}: AccessibleTagInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;

    if (e.key === "Enter" && inputValue) {
      e.preventDefault();
      if (!value.includes(inputValue)) {
        const newValue = [...value, inputValue];
        onChange(newValue);
        setInputValue("");
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      e.preventDefault();
      const newValue = value.slice(0, -1);
      onChange(newValue);
    } else if (e.key === "Escape") {
      input.blur();
    }
  };

  const handleRemoveTag = (tag: string) => {
    const newValue = value.filter((t) => t !== tag);
    onChange(newValue);
    inputRef.current?.focus();
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        className="flex min-h-[40px] w-full flex-wrap gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTag(tag);
              }}
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          className="flex-1 border-0 bg-transparent p-0 placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder={value.length === 0 ? placeholder : ""}
          aria-label={label}
        />
      </div>
      {isOpen && inputValue && (
        <Command className="border shadow-md">
          <CommandGroup>
            <CommandItem
              onSelect={() => {
                if (!value.includes(inputValue)) {
                  onChange([...value, inputValue]);
                }
                setInputValue("");
                inputRef.current?.focus();
              }}
            >
              Add "{inputValue}"
            </CommandItem>
          </CommandGroup>
        </Command>
      )}
    </div>
  );
}
