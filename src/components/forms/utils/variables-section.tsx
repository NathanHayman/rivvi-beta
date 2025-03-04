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
import { UseFormReturn, useFieldArray } from "react-hook-form";
import { FieldArrayItem } from "./field-array-item";

interface VariablesSectionProps {
  form: UseFormReturn<any>;
}

export function VariablesSection({ form }: VariablesSectionProps) {
  const {
    fields: patientFields,
    append: appendPatientField,
    remove: removePatientField,
  } = useFieldArray({
    control: form.control,
    name: "patientFields",
  });

  const {
    fields: campaignFields,
    append: appendCampaignField,
    remove: removeCampaignField,
  } = useFieldArray({
    control: form.control,
    name: "campaignFields",
  });

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Patient Fields</CardTitle>
            <CardDescription>
              Define the patient data fields required for this campaign
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              appendPatientField({
                key: "",
                label: "",
                possibleColumns: [],
                transform: "text",
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
            {patientFields.map((field, index) => (
              <FieldArrayItem
                key={field.id}
                form={form}
                index={index}
                fieldArrayName="patientFields"
                onRemove={() => removePatientField(index)}
                canDelete={index >= 4} // Prevent removing first 4 default fields
                showTransform
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Campaign-Specific Fields</CardTitle>
            <CardDescription>
              Define additional fields specific to this campaign
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
                possibleColumns: [],
                transform: "text",
                required: false,
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
                  fieldArrayName="campaignFields"
                  onRemove={() => removeCampaignField(index)}
                  showTransform
                />
              ))}
            </div>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No campaign-specific fields defined yet
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
                    possibleColumns: [],
                    transform: "text",
                    required: false,
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
