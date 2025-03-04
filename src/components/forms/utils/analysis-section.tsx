"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus } from "lucide-react";
import { type UseFormReturn, useFieldArray } from "react-hook-form";
import { FieldArrayItem } from "./field-array-item";

interface AnalysisSectionProps {
  form: UseFormReturn<any>;
}

export function AnalysisSection({ form }: AnalysisSectionProps) {
  const {
    fields: standardFields,
    append: appendStandardField,
    remove: removeStandardField,
  } = useFieldArray({
    control: form.control,
    name: "standardAnalysisFields",
  });

  const {
    fields: campaignFields,
    append: appendCampaignField,
    remove: removeCampaignField,
  } = useFieldArray({
    control: form.control,
    name: "campaignAnalysisFields",
  });

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Standard Analysis Fields</CardTitle>
            <CardDescription>
              Define the standard metrics to track for this campaign
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              appendStandardField({
                key: "",
                label: "",
                type: "boolean",
                required: false,
              });
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Field
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {standardFields.map((field, index) => (
              <FieldArrayItem
                key={field.id}
                form={form}
                index={index}
                fieldArrayName="standardAnalysisFields"
                onRemove={() => removeStandardField(index)}
                showFieldType
                showOptions
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Campaign-Specific Analysis Fields</CardTitle>
            <CardDescription>
              Define additional metrics specific to this campaign
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              appendCampaignField({
                key: "",
                label: "",
                type: "boolean",
                required: false,
                isMainKPI: false,
              });
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Field
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          {campaignFields.length > 0 ? (
            <div className="space-y-6">
              {campaignFields.map((field, index) => (
                <FieldArrayItem
                  key={field.id}
                  form={form}
                  index={index}
                  fieldArrayName="campaignAnalysisFields"
                  onRemove={() => removeCampaignField(index)}
                  showFieldType
                  showOptions
                  showMainKPI
                />
              ))}
            </div>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No campaign-specific analysis fields defined yet
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  appendCampaignField({
                    key: "",
                    label: "",
                    type: "boolean",
                    required: false,
                    isMainKPI: false,
                  });
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
