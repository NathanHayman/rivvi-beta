"use client";

import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";
import { useState } from "react";
import { CreateRunModal } from "./create-run-modal";

interface CreateRunModalButtonProps extends ButtonProps {
  campaignId: string;
}

export function CreateRunModalButton({
  campaignId,
  className,
  variant = "default",
  ...props
}: CreateRunModalButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={cn(className)}
        variant={variant}
        {...props}
      >
        <Calendar className="mr-1.5 h-4 w-4" />
        Create Run
      </Button>
      <CreateRunModal
        campaignId={campaignId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
