"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { SavedAddress, SavedAddressInput } from "../types";
import { AddressForm } from "./address-form";

type AddressFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: SavedAddress | null;
  onSubmit: (input: SavedAddressInput) => Promise<void>;
};

/**
 * Dialog wrapper that hosts the address form for both "Add address" and
 * "Edit address" flows in the address book.
 */
export function AddressFormDialog({
  open,
  onOpenChange,
  mode,
  initial = null,
  onSubmit,
}: AddressFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit address" : "Add address"}</DialogTitle>
          <DialogDescription>
            Delivery is currently available only in Karachi. Saved addresses can be reused at
            checkout.
          </DialogDescription>
        </DialogHeader>
        <AddressForm
          key={initial?.id ?? "new-address"}
          initial={initial}
          submitLabel={mode === "edit" ? "Save changes" : "Save address"}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
