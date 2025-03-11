// Allow users to call the create run action and then pass in whether it's a sheet or a modal and based on those which will still have the same props will render the trigger sheet thing or trigger modal

import { ModalSizes } from "../modal-form";
import { TriggerModal } from "../modal-trigger";
import { SheetSizes } from "../sheet-form";
import { TriggerSheet } from "../trigger-sheet";

type CreateRunActionProps = {
  type: "modal" | "sheet";
  form: React.ReactNode;
  title: string;
  description?: string;
  buttonText: string;
  buttonIcon?: React.ReactNode;
  onTriggerClick?: (e: React.MouseEvent) => void;
  size?: keyof typeof SheetSizes | keyof typeof ModalSizes;
  onOpenChange?: (open: boolean) => void;
};

export function CreateRunAction(props: CreateRunActionProps) {
  if (!props) return null;
  const { type } = props;

  // Set default size to md for better compact layout
  const defaultProps = {
    ...props,
    size: props.size || (type === "modal" ? "xl" : "md"),
  };

  if (type === "modal") {
    return <TriggerModal {...defaultProps} />;
  }
  return <TriggerSheet {...defaultProps} />;
}
