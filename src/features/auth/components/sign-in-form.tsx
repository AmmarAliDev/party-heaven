"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { z } from "zod";

import { DynamicFormField, useAppForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { Label } from "@/components/ui/label";
import { routes } from "@/config/routes";
import { signInAction, type SignInActionState } from "@/features/auth/actions/sign-in";
import { signInValidator } from "@/features/auth/validators";
import { testIds } from "@/lib/test-selectors";

type SignInFormProps = {
  redirectTo?: string;
};

const signInFormSchema = signInValidator.extend({
  redirectTo: z.string(),
});

type SignInFormValues = z.infer<typeof signInFormSchema>;

function isSafeRelativePath(value: string) {
  let candidate = value.trim();

  try {
    for (let index = 0; index < 3; index += 1) {
      const decodedCandidate = decodeURIComponent(candidate);

      if (decodedCandidate === candidate) {
        break;
      }

      candidate = decodedCandidate;
    }
  } catch {
    return false;
  }

  if (!candidate.startsWith("/")) {
    return false;
  }

  if (candidate.startsWith("//") || candidate.includes("://") || candidate.includes("\\")) {
    return false;
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(candidate.slice(1)) || /[\r\n]/.test(candidate)) {
    return false;
  }

  return true;
}

export function SignInForm({ redirectTo = routes.storefront.home }: SignInFormProps) {
  const [state, dispatch, isPending] = useActionState<SignInActionState | null, FormData>(
    signInAction,
    null,
  );
  const [, startTransition] = useTransition();

  const errors = state?.errors ?? [];
  const safeRedirectTo = isSafeRelativePath(redirectTo)
    ? redirectTo.trim()
    : routes.storefront.home;

  const form = useAppForm<SignInFormValues>({
    schema: signInFormSchema,
    defaultValues: {
      email: "",
      password: "",
      redirectTo: safeRedirectTo,
    },
  });

  return (
    <form
      className="space-y-4"
      noValidate
      data-testid={testIds.auth.signInForm}
      onSubmit={form.handleSubmit((values) => {
        const formData = new FormData();
        formData.set("email", values.email);
        formData.set("password", values.password);
        formData.set("redirectTo", values.redirectTo);

        startTransition(() => {
          dispatch(formData);
        });
      })}
    >
      <FormErrorSummary errors={form.formState.errors} title="Please review your sign-in details" />

      {errors.length > 0 ? (
        <div
          id="sign-in-errors"
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-[calc(var(--radius)-2px)] border px-4 py-3 text-sm"
        >
          {errors.map((error, index) => (
            <p key={`${error}-${index}`}>{error}</p>
          ))}
        </div>
      ) : null}

      <DynamicFormField
        control={form.control}
        disabled={isPending}
        fieldConfig={{
          id: "sign-in-email",
          name: "email",
          type: "email",
          label: "Email address",
          autoComplete: "email",
          placeholder: "you@example.com",
          required: true,
        }}
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="sign-in-password">Password</Label>
          <Link
            href={routes.auth.forgotPassword}
            className="text-muted-foreground text-xs underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <DynamicFormField
          control={form.control}
          disabled={isPending}
          fieldConfig={{
            id: "sign-in-password",
            name: "password",
            type: "password",
            autoComplete: "current-password",
            placeholder: "••••••••",
            required: true,
          }}
        />
      </div>

      <DynamicFormField
        control={form.control}
        disabled={isPending}
        fieldConfig={{
          name: "redirectTo",
          type: "hidden",
        }}
      />

      <Button
        type="submit"
        className="w-full"
        disabled={isPending}
        data-testid={testIds.auth.signInSubmit}
      >
        {isPending ? <InlineSpinner /> : null}
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
