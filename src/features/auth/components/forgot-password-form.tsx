"use client";

import { useActionState, useEffect, useTransition } from "react";

import { DynamicFormField, useAppForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  forgotPasswordAction,
  type ForgotPasswordActionState,
  forgotPasswordSuccessMessage,
} from "@/features/auth/actions/forgot-password";
import { type ForgotPasswordInput,forgotPasswordValidator } from "@/features/auth/validators";

export function ForgotPasswordForm() {
  const [state, dispatch, isPending] = useActionState<ForgotPasswordActionState | null, FormData>(
    forgotPasswordAction,
    null,
  );
  const [, startTransition] = useTransition();

  const form = useAppForm<ForgotPasswordInput>({
    schema: forgotPasswordValidator,
    defaultValues: {
      email: "",
    },
  });

  const errors = state?.errors ?? [];
  const successMessage = state?.success ? state.message ?? forgotPasswordSuccessMessage : null;

  // Reset the form fields when the action succeeds so the email input is
  // cleared and the user cannot accidentally re-submit the same request.
  useEffect(() => {
    if (state?.success) {
      form.reset();
    }
  }, [state, form]);

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit((values) => {
        const formData = new FormData();
        formData.set("email", values.email);

        startTransition(() => {
          dispatch(formData);
        });
      })}
    >
      <FormErrorSummary errors={form.formState.errors} title="Please review your email address" />

      {errors.length > 0 ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-[calc(var(--radius)-2px)] border px-4 py-3 text-sm"
        >
          {errors.map((error, index) => (
            <p key={`${error}-${index}`}>{error}</p>
          ))}
        </div>
      ) : null}

      {successMessage ? (
        <div
          role="status"
          className="rounded-[calc(var(--radius)-2px)] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800"
        >
          {successMessage}
        </div>
      ) : null}

      <DynamicFormField
        control={form.control}
        disabled={isPending}
        fieldConfig={{
          id: "forgot-password-email",
          name: "email",
          type: "email",
          label: "Email address",
          autoComplete: "email",
          placeholder: "you@example.com",
          required: true,
        }}
      />

      <Button type="submit" className="w-full" disabled={isPending || !!successMessage}>
        {isPending ? <InlineSpinner /> : null}
        {isPending ? "Sending reset link…" : "Send reset link"}
      </Button>
    </form>
  );
}
