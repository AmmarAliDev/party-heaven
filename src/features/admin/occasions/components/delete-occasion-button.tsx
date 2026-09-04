"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

import { deleteAdminOccasionAction } from "../actions";

type DeleteOccasionButtonProps = {
  occasionId: string;
  occasionName: string;
  returnTo: string;
};

export function DeleteOccasionButton({ occasionId, occasionName, returnTo }: DeleteOccasionButtonProps) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <>
      <form ref={formRef} action={deleteAdminOccasionAction}>
        <input type="hidden" name="occasionId" value={occasionId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setOpen(true)}
        >
          Delete
        </Button>
      </form>

      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${occasionName}?`}
        description="This permanently removes the occasion and its curated links. The linked products and deals are not affected."
        confirmLabel="Delete occasion"
        confirmVariant="destructive"
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </>
  );
}
