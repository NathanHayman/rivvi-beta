"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { SheetForm } from "./sheet-form";

interface TriggerSheetProps {
  form: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
  buttonText: string;
  buttonIcon?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

const TriggerSheet = ({
  form,
  title,
  onOpenChange,
  description,
  className,
  buttonText,
  buttonIcon,
}: TriggerSheetProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button className={className} onClick={() => setOpen(true)}>
        {buttonIcon && buttonIcon}
        {buttonText}
      </Button>
      <SheetForm
        open={open}
        setOpen={setOpen}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
      >
        {form}
      </SheetForm>
    </>
  );
};

export { TriggerSheet };
