"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { SheetForm, SheetSizes } from "./sheet-form";

interface TriggerSheetProps {
  form: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
  size?: keyof typeof SheetSizes;
  buttonText: string;
  buttonIcon?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  onTriggerClick?: (e: React.MouseEvent) => void;
}

const TriggerSheet = ({
  form,
  title,
  onOpenChange,
  description,
  className,
  buttonText,
  buttonIcon,
  onTriggerClick,
  size,
}: TriggerSheetProps) => {
  const [open, setOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (onTriggerClick) {
      onTriggerClick(e);
    }
    setOpen(true);
  };

  return (
    <>
      <Button className={className} onClick={handleClick}>
        {buttonIcon && buttonIcon}
        {buttonText}
      </Button>
      <SheetForm
        open={open}
        setOpen={setOpen}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        size={size}
      >
        {form}
      </SheetForm>
    </>
  );
};

export { TriggerSheet };
