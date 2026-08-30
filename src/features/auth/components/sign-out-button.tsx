"use client";

import { useState } from "react";
import { signOut as clientSignOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { prepareSignOutAction, signOutAction } from "@/features/auth/actions/sign-out";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

type SignOutButtonProps = Omit<ButtonProps, "children" | "type"> & {
  label?: string;
  pendingLabel?: string;
  showIcon?: boolean;
  showText?: boolean;
  fullWidth?: boolean;
  formClassName?: string;
  onBeforeSubmit?: () => void;
};

type SubmitButtonProps = Omit<SignOutButtonProps, "formClassName" | "onBeforeSubmit">;

function SubmitButton({
  label = "Sign out",
  pendingLabel = "Signing out...",
  showIcon = true,
  fullWidth = false,
  showText = true,
  isSubmitting = false,
  className,
  disabled,
  ...buttonProps
}: SubmitButtonProps & { isSubmitting?: boolean }) {
  const { pending } = useFormStatus();
  const isBusy = pending || isSubmitting;

  return (
    <Button
      type="submit"
      aria-busy={isBusy}
      disabled={isBusy || disabled}
      className={cn(fullWidth ? "w-full" : undefined, className)}
      {...buttonProps}
    >
      {showIcon ? <LogOut className="size-4" aria-hidden="true" /> : null}
      {showText ? (isBusy ? pendingLabel : label) : null}
    </Button>
  );
}

/**
 * Shared sign-out submit control.
 *
 * Uses the CSRF-checked `signOutAction` server action through a normal form
 * submission so logout stays reliable in server, client, and progressively
 * enhanced navigation contexts.
 */
export function SignOutButton({ formClassName, onBeforeSubmit, ...buttonProps }: SignOutButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      action={signOutAction}
      className={formClassName}
      onSubmit={async (event) => {
        event.preventDefault();

        if (isSubmitting) {
          return;
        }

        onBeforeSubmit?.();
        setIsSubmitting(true);

        try {
          await prepareSignOutAction();
        } catch (error) {
          console.error("Failed to prepare sign-out cart context.", error);
        }

        try {
          // Using client signOut keeps SessionProvider state in sync immediately.
          await clientSignOut({ redirectTo: routes.storefront.home });
        } catch (error) {
          console.error("Client sign-out failed; falling back to server action.", error);

          try {
            await signOutAction();
            return;
          } catch (fallbackError) {
            console.error("Server sign-out fallback failed.", fallbackError);
            notify.error("Sign out failed", "Please try again.");
          }
        }

        setIsSubmitting(false);
      }}
    >
      <SubmitButton isSubmitting={isSubmitting} {...buttonProps} />
    </form>
  );
}
