"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dispatchCartChanged } from "@/features/cart/client-events";
import type { CartSummary } from "@/features/cart/types";
import { AppError } from "@/lib/errors/app-error";
import { toUserMessage } from "@/lib/errors/error-messages";
import { notify } from "@/lib/notify";

type CartItemQuantityControlsProps = {
  cartItemId: string;
  productName: string;
  quantity: number;
  availableQuantity: number;
  /**
   * When set, the control targets a deal bundle line instead of a regular
   * product line (PATCH/DELETE use `dealCartItemId` payloads).
   */
  dealCartItemId?: string;
};

type CartMutationPayload = {
  cart?: CartSummary | null;
  error?: string;
};

const MAX_CART_ITEM_QUANTITY = 99;

function getEffectiveAllowedMax(availableQuantity: number) {
  return Math.max(1, Math.min(MAX_CART_ITEM_QUANTITY, Math.trunc(availableQuantity)));
}

/**
 * Parses an integer (optionally negative) quantity. Returns null for floats,
 * empty strings, and any other non-integer input.
 */
function parseWholeQuantity(value: string) {
  const trimmed = value.trim();

  if (!/^-?\d+$/.test(trimmed)) {
    return null;
  }

  return Number.parseInt(trimmed, 10);
}

async function updateQuantity(itemId: string, quantity: number, dealLine: boolean) {
  const response = await fetch("/api/cart", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      dealLine
        ? {
            dealCartItemId: itemId,
            quantity,
          }
        : {
            cartItemId: itemId,
            quantity,
          },
    ),
  });

  const payload = (await response.json().catch(() => null)) as CartMutationPayload | null;

  if (!response.ok) {
    throw new AppError("Cart quantity request failed.", "INTERNAL_ERROR", {
      userMessage: payload?.error ?? "Could not update cart quantity right now. Please try again.",
    });
  }

  return payload?.cart ?? null;
}

async function removeItem(itemId: string, dealLine: boolean) {
  const response = await fetch("/api/cart", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      dealLine
        ? {
            dealCartItemId: itemId,
          }
        : {
            cartItemId: itemId,
          },
    ),
  });

  const payload = (await response.json().catch(() => null)) as CartMutationPayload | null;

  if (!response.ok) {
    throw new AppError("Cart remove request failed.", "INTERNAL_ERROR", {
      userMessage: payload?.error ?? "Could not remove this item right now. Please try again.",
    });
  }

  return payload?.cart ?? null;
}

export function CartItemQuantityControls({
  cartItemId,
  productName,
  quantity,
  availableQuantity,
  dealCartItemId,
}: CartItemQuantityControlsProps) {
  const effectiveAllowedMax = getEffectiveAllowedMax(availableQuantity);
  const dealLine = Boolean(dealCartItemId);
  const itemId = dealCartItemId ?? cartItemId;
  const [pending, setPending] = useState(false);
  const [displayQuantity, setDisplayQuantity] = useState(quantity);
  const [inputValue, setInputValue] = useState(String(quantity));

  useEffect(() => {
    setDisplayQuantity(quantity);
    setInputValue(String(quantity));
  }, [quantity]);

  const canDecrease = displayQuantity > 1;
  const canIncrease = displayQuantity < effectiveAllowedMax;

  async function runMutation(action: () => Promise<CartSummary | null>, optimisticQuantity: number) {
    if (pending) {
      return;
    }

    const previousQuantity = displayQuantity;
    setPending(true);
    setDisplayQuantity(Math.max(0, optimisticQuantity));

    try {
      const cart = await action();
      const nextQuantity =
        [...(cart?.items ?? []), ...(cart?.dealItems ?? [])].find((item) => item.id === itemId)?.quantity ?? 0;

      dispatchCartChanged(cart);
      setDisplayQuantity(nextQuantity);
      setInputValue(String(nextQuantity));
    } catch (error) {
      setDisplayQuantity(previousQuantity);
      setInputValue(String(previousQuantity));
      notify.error("Could not update your cart", toUserMessage(error));
    } finally {
      setPending(false);
    }
  }

  /**
   * Normalize and commit a direct quantity input.
   * - Floats and other non-integer values keep the previous quantity and are
   *   not committed.
   * - Integers are clamped into [1, effectiveAllowedMax] before committing
   *   (negative/zero → 1, above max → max).
   * Does not trigger mutation if the resulting value is unchanged.
   */
  async function commitDirectInput() {
    const parsed = parseWholeQuantity(inputValue);

    // Float or any other non-integer value: keep the previous value, don't update.
    if (parsed === null) {
      setInputValue(String(displayQuantity));
      return;
    }

    const committedQuantity = Math.min(Math.max(parsed, 1), effectiveAllowedMax);

    // Revert to current display if no change
    if (committedQuantity === displayQuantity) {
      setInputValue(String(displayQuantity));
      return;
    }

    // Commit the change via mutation
    await runMutation(() => updateQuantity(itemId, committedQuantity, dealLine), committedQuantity);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Raw input is kept as typed; normalization happens on commit (blur/Enter).
    setInputValue(e.target.value);
  }

  function handleInputBlur() {
    void commitDirectInput();
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitDirectInput();
      // Blur to clear focus after successful commit
      (e.currentTarget as HTMLInputElement).blur();
    }
  }

  return (
    <div className="flex items-center gap-1 md:gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="max-w-7 max-h-7 shrink-0"
        onClick={() => runMutation(() => updateQuantity(itemId, displayQuantity - 1, dealLine), displayQuantity - 1)}
        disabled={pending || !canDecrease}
        aria-label={`Decrease quantity for ${productName}`}
      >
        <Minus className="size-4" aria-hidden="true" />
      </Button>

      <div className="space-y-1">
        <Input
          type="number"
          min="1"
          max={effectiveAllowedMax}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          disabled={pending}
          aria-label={`Quantity for ${productName}. Minimum 1, maximum ${effectiveAllowedMax}`}
          className="max-w-14 max-h-7 p-2 text-center text-sm font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="max-w-7 max-h-7 shrink-0"
        onClick={() => runMutation(() => updateQuantity(itemId, displayQuantity + 1, dealLine), displayQuantity + 1)}
        disabled={pending || !canIncrease}
        aria-label={`Increase quantity for ${productName}`}
      >
        <Plus className="size-4" aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => runMutation(() => removeItem(itemId, dealLine), 0)}
        disabled={pending}
        aria-label={`Remove ${productName} from cart`}
      >
        <Trash2 className="size-5" aria-hidden="true" />
      </Button>
    </div>
  );
}
