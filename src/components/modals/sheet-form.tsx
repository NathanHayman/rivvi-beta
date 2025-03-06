"use client";

import { Dispatch, SetStateAction } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";

export const SheetSizes = {
  sm: "w-full lg:w-3/5 lg:max-w-[400px]",
  md: "w-full lg:w-3/5 lg:max-w-[600px]",
  lg: "w-full lg:w-3/5 lg:max-w-[800px]",
  xl: "w-full lg:w-3/5 lg:max-w-[1000px]",
} as const;

interface SheetFormProps {
  children?: React.ReactNode;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  size?: keyof typeof SheetSizes;
}

const SheetForm = (props: SheetFormProps) => {
  return (
    <Sheet open={props.open} onOpenChange={props.setOpen}>
      <SheetContent side="right" className={SheetSizes[props.size || "md"]}>
        <SheetHeader>
          <SheetTitle>{props.title}</SheetTitle>
          {props.description && (
            <SheetDescription>{props.description}</SheetDescription>
          )}
        </SheetHeader>
        <div className="relative h-[calc(94vh-37px)]">{props.children}</div>
      </SheetContent>
    </Sheet>
  );
};

export { SheetForm };
