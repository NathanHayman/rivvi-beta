"use client";

import { FormControl } from "@/components/ui/form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { AccessibleTagInput } from "./accessible-tag-input";

interface FieldArrayItemProps {
  form: UseFormReturn<any>;
  index: number;
  fieldArrayName: string;
  onRemove: () => void;
  canDelete?: boolean;
  showTransform?: boolean;
  showFieldType?: boolean;
  showMainKPI?: boolean;
  showOptions?: boolean;
}

export function FieldArrayItem({
  form,
  index,
  fieldArrayName,
  onRemove,
  canDelete = true,
  showTransform = false,
  showFieldType = false,
  showMainKPI = false,
  showOptions = false,
}: FieldArrayItemProps) {
  const fieldPrefix = `${fieldArrayName}.${index}`;
  const label = form.watch(`${fieldPrefix}.label`) || "New Field";
  const isRequired = form.watch(`${fieldPrefix}.required`);
  const isMainKPI = form.watch(`${fieldPrefix}.isMainKPI`);
  const fieldType = form.watch(`${fieldPrefix}.type`);

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{label}</h4>
          {isRequired && (
            <Badge variant="outline" className="text-xs">
              Required
            </Badge>
          )}
          {isMainKPI && (
            <Badge className="bg-primary/20 text-xs text-primary">
              Main KPI
            </Badge>
          )}
        </div>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 w-8 p-0 text-muted-foreground"
          >
            <span className="sr-only">Remove field</span>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name={`${fieldPrefix}.key`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Field Key</FormLabel>
              <Input
                {...field}
                placeholder="e.g., firstName"
                aria-label={`Field key for ${label}`}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`${fieldPrefix}.label`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Label</FormLabel>
              <Input
                {...field}
                placeholder="e.g., First Name"
                aria-label={`Display label for ${field.value || "this field"}`}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {showTransform && (
          <FormField
            control={form.control}
            name={`${fieldPrefix}.transform`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transform Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select transform" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="short_date">Short Date</SelectItem>
                    <SelectItem value="long_date">Long Date</SelectItem>
                    <SelectItem value="time">Time</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="provider">Provider</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {showFieldType && (
          <FormField
            control={form.control}
            name={`${fieldPrefix}.type`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Field Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="enum">Enum</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {showOptions && fieldType === "enum" && (
          <FormField
            control={form.control}
            name={`${fieldPrefix}.options`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Options</FormLabel>
                <AccessibleTagInput
                  value={field.value || []}
                  onChange={field.onChange}
                  placeholder="Type option and press Enter"
                  label={`Options for ${label}`}
                />
                <FormDescription className="text-xs">
                  Type each option and press Enter
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name={`${fieldPrefix}.possibleColumns`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Possible Column Names</FormLabel>
              <AccessibleTagInput
                value={field.value || []}
                onChange={field.onChange}
                placeholder="Type column name and press Enter"
                label={`Possible column names for ${label}`}
              />
              <FormDescription className="text-xs">
                Column names that might match this field in uploaded data
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex space-x-4 pt-2">
          <FormField
            control={form.control}
            name={`${fieldPrefix}.required`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label={`Mark ${label} as required`}
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal">Required</FormLabel>
              </FormItem>
            )}
          />

          {showMainKPI && (
            <FormField
              control={form.control}
              name={`${fieldPrefix}.isMainKPI`}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label={`Mark ${label} as main KPI`}
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal">
                    Main KPI
                  </FormLabel>
                </FormItem>
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}
