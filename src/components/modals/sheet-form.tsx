"use client";

import { Dispatch, SetStateAction } from "react";
import { ScrollArea } from "../ui/scroll-area";
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
      <SheetContent side="right" className="lg:max-w-screen-xs w-full lg:w-3/5">
        <SheetHeader>
          <SheetTitle>{props.title}</SheetTitle>
          {props.description && (
            <SheetDescription>{props.description}</SheetDescription>
          )}
        </SheetHeader>
        <ScrollArea className="mt-4 h-full">{props.children}</ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export { SheetForm };
