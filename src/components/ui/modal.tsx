"use client";

import { useMediaQuery2 } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { useRouter } from "next/navigation";
import { ComponentProps, Dispatch, SetStateAction } from "react";
import { Drawer } from "vaul";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import {
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "./drawer";

interface BaseProps {
  className?: string;
  children: React.ReactNode;
}

interface ModalProps extends BaseProps {
  asChild?: true;
}

interface RootModalProps extends BaseProps {
  showModal?: boolean;
  setShowModal?: Dispatch<SetStateAction<boolean>>;
  onClose?: () => void;
  desktopOnly?: boolean;
  preventDefaultClose?: boolean;
  drawerRootProps?: ComponentProps<typeof Drawer.Root>;
}

const Modal = ({ children, ...props }: RootModalProps) => {
  const router = useRouter();

  const closeModal = ({ dragged }: { dragged?: boolean } = {}) => {
    if (props.preventDefaultClose && !dragged) {
      return;
    }
    // fire onClose event if provided
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    props.onClose && props.onClose();

    // if setShowModal is defined, use it to close modal
    if (props.setShowModal) {
      props.setShowModal(false);
      // else, this is intercepting route @modal
    } else {
      router.back();
    }
  };

  const { isMobile } = useMediaQuery2();

  if (isMobile && !props.desktopOnly) {
    return (
      <Drawer.Root
        open={props.setShowModal ? props.showModal : true}
        onOpenChange={(open) => {
          if (!open) {
            closeModal({ dragged: true });
          }
        }}
        {...props.drawerRootProps}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-zinc-100 bg-opacity-10 backdrop-blur dark:bg-zinc-900 dark:bg-opacity-10" />
          <Drawer.Content
            className={cn(
              "fixed bottom-0 left-0 right-0 z-50 h-full max-h-[95dvh] rounded-t-[10px] border-t border-muted/80 bg-card",
              props.className,
            )}
          >
            <VisuallyHidden.Root>
              <Drawer.Title>Modal</Drawer.Title>
              <Drawer.Description>This is a modal</Drawer.Description>
            </VisuallyHidden.Root>
            <div className="sticky top-0 z-20 flex w-full items-center justify-center rounded-t-[10px] bg-inherit">
              <div className="my-3 h-1 w-12 rounded-full bg-muted" />
            </div>
            {children}
          </Drawer.Content>
          <Drawer.Overlay />
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog.Root
      open={props.setShowModal ? props.showModal : true}
      onOpenChange={(open) => {
        if (!open) {
          closeModal();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          // for detecting when there's an active opened modal
          id="modal-backdrop"
          className="fixed inset-0 z-40 animate-fade-in bg-zinc-100 bg-opacity-50 backdrop-blur-md dark:bg-zinc-900 dark:bg-opacity-50"
        />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "fixed inset-0 z-40 m-auto max-h-fit w-full max-w-3xl animate-scale-in overflow-hidden border border-muted-foreground/10 bg-card shadow-xl sm:rounded-2xl",
            props.className,
          )}
        >
          <VisuallyHidden.Root>
            <Dialog.Title>Modal</Dialog.Title>
            <Dialog.Description>This is a modal</Dialog.Description>
          </VisuallyHidden.Root>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const ModalDescription = ({ className, children, ...props }: ModalProps) => {
  const isDesktop = useMediaQuery2();
  const ModalDescription = isDesktop ? DialogDescription : DrawerDescription;

  return (
    <ModalDescription className={cn("text-left", className)} {...props}>
      {children}
    </ModalDescription>
  );
};

const ModalHeader = ({ className, children, ...props }: ModalProps) => {
  const isDesktop = useMediaQuery2();
  const ModalHeader = isDesktop ? DialogHeader : DrawerHeader;

  return (
    <ModalHeader
      className={cn(
        "flex flex-col items-start gap-2 p-4 text-left sm:p-6 sm:text-center",
        className,
      )}
      {...props}
    >
      {children}
    </ModalHeader>
  );
};

const ModalTitle = ({ className, children, ...props }: ModalProps) => {
  const isDesktop = useMediaQuery2();
  const ModalTitle = isDesktop ? DialogTitle : DrawerTitle;

  return (
    <ModalTitle className={className} {...props}>
      {children}
    </ModalTitle>
  );
};

const ModalBody = ({ className, children, ...props }: ModalProps) => {
  return (
    <div className={cn("p-4 sm:p-6", className)} {...props}>
      {children}
    </div>
  );
};

const ModalFooter = ({ className, children, ...props }: ModalProps) => {
  const isDesktop = useMediaQuery2();
  const ModalFooter = isDesktop ? DialogFooter : DrawerFooter;

  return (
    <ModalFooter
      className={cn("p-4 py-3 sm:p-6 sm:py-4", className)}
      {...props}
    >
      {children}
    </ModalFooter>
  );
};

const ModalTrigger = ({ children, ...props }: ModalProps) => {
  return <Dialog.Trigger {...props}>{children}</Dialog.Trigger>;
};

export {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
};
