"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { routes } from "@/config/routes";
import { reorderOrderAction } from "@/features/orders/actions/reorder";
import { initialReorderActionState } from "@/features/orders/actions/reorder-types";
import { cn } from "@/lib/utils";

type ReorderOrderFormProps = {
  orderNumber: string;
  compact?: boolean;
};

export function ReorderOrderForm({ orderNumber, compact = false }: ReorderOrderFormProps) {
  const [state, formAction, isPending] = useActionState(reorderOrderAction, initialReorderActionState);

  return (
    <div className="space-y-3">
      <form action={formAction}>
        <input type="hidden" name="orderNumber" value={orderNumber} />
        <Button type="submit" variant={compact ? "outline" : "default"} size={compact ? "sm" : "default"}>
          {isPending ? <InlineSpinner /> : null}
          {isPending ? "Re-ordering..." : "Re-order items"}
        </Button>
      </form>

      {state.message ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            state.ok
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
              : "border-destructive/40 bg-destructive/5 text-destructive",
          )}
          role="status"
        >
          <p>{state.message}</p>

          {state.issues.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs">
              {state.issues.slice(0, 3).map((issue, idx) => (
                <li key={`${issue.productName}-${issue.reason}-${idx}`}>{issue.message}</li>
              ))}
            </ul>
          ) : null}

          {state.ok ? (
            <Link href={routes.storefront.cart} className="mt-2 inline-flex text-xs font-medium underline underline-offset-4">
              View cart
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
