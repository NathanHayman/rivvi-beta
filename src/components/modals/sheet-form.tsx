"use client";

import { Dispatch, SetStateAction } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";

interface SheetFormProps {
  children?: React.ReactNode;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
}

const SheetForm = (props: SheetFormProps) => {
  return (
    <Sheet open={props.open} onOpenChange={props.setOpen}>
      <SheetContent side="right" className="w-full lg:w-3/5 lg:max-w-[800px]">
        <SheetHeader>
          <SheetTitle>{props.title}</SheetTitle>
          {props.description && (
            <SheetDescription>{props.description}</SheetDescription>
          )}
        </SheetHeader>
        {props.children}
      </SheetContent>
    </Sheet>
  );
};

export { SheetForm };
