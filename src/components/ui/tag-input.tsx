"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import React, { useState } from "react";

interface TagInputProps {
  initialTags?: string[];
  onTagsChange: (tags: string[]) => void;
  unique?: boolean;
  placeholder?: string;
}

export function TagInput({
  initialTags = [],
  onTagsChange,
  unique = false,
  placeholder = "Type and press Enter...",
}: TagInputProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [inputValue, setInputValue] = useState<string>("");

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      (event.key === "Enter" || event.key === ",") &&
      inputValue.trim() !== ""
    ) {
      event.preventDefault();
      const newTag = inputValue.trim();
      const newTags = unique
        ? [...new Set([...tags, newTag])]
        : [...tags, newTag];
      setTags(newTags);
      onTagsChange(newTags);
      setInputValue("");
    } else if (event.key === "Backspace" && inputValue === "") {
      event.preventDefault();
      const newTags = tags.slice(0, -1);
      setTags(newTags);
      onTagsChange(newTags);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const paste = event.clipboardData.getData("text");
    const tagsToAdd = paste
      .split(/[\n\t,]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (tagsToAdd.length) {
      const newTags = unique
        ? [...new Set([...tags, ...tagsToAdd])]
        : [...tags, ...tagsToAdd];
      setTags(newTags);
      onTagsChange(newTags);
      setInputValue("");
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (inputValue.trim() !== "" && event.relatedTarget?.tagName !== "BUTTON") {
      const newTags = [...tags, inputValue.trim()];
      setTags(newTags);
      onTagsChange(newTags);
      setInputValue("");
    }
  };

  const removeTag = (indexToRemove: number) => {
    const newTags = tags.filter((_, index) => index !== indexToRemove);
    setTags(newTags);
    onTagsChange(newTags);
  };

  return (
    <div className="flex w-full flex-wrap items-center rounded-md border border-input bg-background p-2.5 py-2 text-sm ring-offset-background">
      <div className="flex w-full flex-wrap items-center gap-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex h-8 items-center rounded-md bg-secondary py-0 pl-3 pr-1 text-xs font-medium text-secondary-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="ml-2 mr-1 rounded-full p-0.5 hover:bg-secondary-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          className={cn(
            "flex-1 bg-transparent outline-none placeholder:text-muted-foreground",
            "bg-accent/50 text-xs font-medium text-secondary-foreground",
            "rounded-md border-accent ring-0 focus:outline-none focus:ring-0 focus:ring-offset-0",
            tags.length === 0 && "w-full",
          )}
          placeholder={tags.length === 0 ? placeholder : ""}
        />
      </div>
    </div>
  );
}
