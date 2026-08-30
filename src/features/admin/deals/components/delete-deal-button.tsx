"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

import { deleteAdminDealAction } from "../actions";

type DeleteDealButtonProps = {
  dealId: string;
  dealTitle: string;
  returnTo: string;
};

export function DeleteDealButton({ dealId, dealTitle, returnTo }: DeleteDealButtonProps) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <>
      <form ref={formRef} action={deleteAdminDealAction}>
        <input type="hidden" name="dealId" value={dealId} />
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
        title={`Delete ${dealTitle}?`}
        description="This permanently removes the deal and its deal-specific images. The linked product is not affected."
        confirmLabel="Delete deal"
        confirmVariant="destructive"
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </>
  );
}
