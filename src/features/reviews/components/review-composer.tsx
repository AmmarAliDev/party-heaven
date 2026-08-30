"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { AppError } from "@/lib/errors/app-error";
import { toUserMessage } from "@/lib/errors/error-messages";

import { getReviewErrorMessage, getReviewNoticeMessage } from "../flash";
import { CustomerReviewForm } from "./customer-review-form";

type ReviewComposerProps = {
  /** Product target id — set when reviewing a product (PDP). */
  productId?: string;
  /** Deal target id — set when reviewing a deal bundle (DDP). */
  dealId?: string;
  returnTo: string;
};

type ComposerContextPayload = {
  ok: true;
  context: {
    canSubmit: boolean;
    reason: "AUTH_REQUIRED" | "PURCHASE_REQUIRED" | null;
    existingReview: {
      rating: number;
      title: string | null;
      body: string | null;
      statusLabel: string;
    } | null;
  };
};

async function fetchComposerContext(productId?: string, dealId?: string) {
  const params = new URLSearchParams();

  if (productId) {
    params.set("productId", productId);
  }

  if (dealId) {
    params.set("dealId", dealId);
  }

  const response = await fetch(`/api/reviews/composer-context?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    throw new AppError("Failed to load customer review composer context.", "INTERNAL_ERROR", {
      userMessage: payload?.error ?? "We could not load review controls right now. Please try again.",
    });
  }

  return (await response.json()) as ComposerContextPayload;
}

/**
 * Review entry point for the PDP/DDP reviews section. Replaces the old inline
 * "Write a review" box with an "Add review" button that opens a dialog
 * containing the existing customer review form.
 */
export function ReviewComposer({ productId, dealId, returnTo }: ReviewComposerProps) {
  const [pending, setPending] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [context, setContext] = useState<ComposerContextPayload["context"] | null>(null);
  const searchParams = useSearchParams();
  const noticeCode = searchParams.get("reviewNotice");
  const reviewNoticeCode = noticeCode === "submitted" || noticeCode === "updated" ? noticeCode : undefined;
  const noticeMessage = getReviewNoticeMessage(noticeCode);
  const reviewErrorMessage = getReviewErrorMessage(searchParams.get("reviewError"));

  const loadComposerContext = useCallback(async () => {
    setPending(true);
    setErrorMessage(null);

    try {
      const payload = await fetchComposerContext(productId, dealId);
      setContext(payload.context);
    } catch (error) {
      setErrorMessage(toUserMessage(error));
    } finally {
      setPending(false);
    }
  }, [productId, dealId]);

  useEffect(() => {
    void loadComposerContext();
  }, [loadComposerContext]);

  if (pending) {
    return <InlineSpinner label="Loading review options" />;
  }

  if (errorMessage) {
    return (
      <div className="flex flex-col items-end gap-2">
        <p className="text-sm text-destructive">Review options are unavailable.</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void loadComposerContext();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const resolvedContext = context ?? {
    canSubmit: false,
    reason: "AUTH_REQUIRED" as const,
    existingReview: null,
  };

  const isDeal = Boolean(dealId);
  const disabledReason =
    resolvedContext.reason === "AUTH_REQUIRED"
      ? "Sign in to submit your review."
      : resolvedContext.reason === "PURCHASE_REQUIRED"
        ? `Reviews unlock after your delivered order for this ${isDeal ? "deal" : "product"}.`
        : undefined;

  return (
    <div className="flex flex-col items-end gap-2">
      {noticeMessage ? (
        <div
          role="status"
          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900"
        >
          {noticeMessage}
        </div>
      ) : null}

      {reviewErrorMessage ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {reviewErrorMessage}
        </div>
      ) : null}

      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            {resolvedContext.existingReview ? "Update review" : "Add review"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{resolvedContext.existingReview ? "Update your review" : "Write a review"}</DialogTitle>
            <DialogDescription>
              {resolvedContext.existingReview
                ? `Your existing review (${resolvedContext.existingReview.statusLabel}) will be resubmitted for moderation.`
                : isDeal
                  ? "Tell others what you thought of this deal bundle. Reviews are moderated before appearing on the storefront."
                  : "Tell others what you thought of this product. Reviews are moderated before appearing on the storefront."}
            </DialogDescription>
          </DialogHeader>

          <CustomerReviewForm
            {...(productId ? { productId } : {})}
            {...(dealId ? { dealId } : {})}
            returnTo={returnTo}
            reviewNoticeCode={reviewNoticeCode}
            canSubmit={resolvedContext.canSubmit}
            disabledReason={disabledReason}
            existingReview={resolvedContext.existingReview}
            embedded
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
