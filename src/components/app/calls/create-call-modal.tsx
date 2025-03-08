"use client";

import { PatientSearch } from "@/components/app/patient/patient-search";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useOrg } from "@/hooks/use-org";
import { createCall } from "@/server/actions/calls/create";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function CreateCallModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { org } = useOrg();
  const router = useRouter();

  const handlePatientSelect = (patient: any) => {
    setSelectedPatient(patient);
  };

  const handleCreateCall = async () => {
    if (!selectedPatient || !org) return;

    try {
      setIsCreating(true);
      const call = await createCall({
        patientId: selectedPatient.id,
        agentId: "default", // Use default agent or provide a dropdown to select
      });

      toast.success("Call created successfully");
      setIsOpen(false);

      // Navigate to the call details page
      router.push(`/calls?callId=${call.id}`);
    } catch (error) {
      console.error("Error creating call:", error);
      toast.error("Failed to create call");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Create Call</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Call</DialogTitle>
          <DialogDescription>
            Search for a patient to create a new call.
          </DialogDescription>
        </DialogHeader>

        {org && (
          <PatientSearch
            orgId={org.id}
            onPatientSelect={handlePatientSelect}
            includeRecentCalls={true}
          />
        )}

        {selectedPatient && (
          <div className="mt-4 rounded-md border p-4">
            <h3 className="font-medium">Selected Patient</h3>
            <p>
              {selectedPatient.firstName} {selectedPatient.lastName}
            </p>
            <p className="text-sm text-muted-foreground">
              {selectedPatient.primaryPhone}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateCall}
            disabled={!selectedPatient || isCreating}
          >
            {isCreating ? "Creating..." : "Create Call"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
