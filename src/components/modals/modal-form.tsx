"use client";

import { cn } from "@/lib/utils";
import { Dispatch, SetStateAction } from "react";
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "../ui/modal";

export const ModalSizes = {
  sm: "w-full lg:max-w-[400px]",
  md: "w-full lg:max-w-[550px]",
  lg: "w-fit min-w-[500px] lg:max-w-[750px]",
  xl: "w-fit min-w-[700px] lg:max-w-[1000px]",
  xxl: "w-full lg:max-w-[1200px]",
} as const;

interface ModalFormProps {
  children?: React.ReactNode;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  size?: keyof typeof ModalSizes;
}

const ModalForm = (props: ModalFormProps) => {
  return (
    <Modal
      showModal={props.open}
      setShowModal={props.setOpen}
      className={cn(ModalSizes[props.size || "lg"], "w-fit")}
    >
      <ModalHeader>
        <ModalTitle>{props.title}</ModalTitle>
        {props.description && (
          <ModalDescription>{props.description}</ModalDescription>
        )}
      </ModalHeader>
      <ModalBody className={cn("relative w-full")}>{props.children}</ModalBody>
    </Modal>
  );
};

export { ModalForm };
