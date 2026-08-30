"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller } from "react-hook-form";

import { DynamicFormField, useAppForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { PriceDisplay } from "@/components/ui/price-display";
import type { CartSummary } from "@/features/cart/types";
import {
  CHECKOUT_FIXED_PROVINCE,
  CHECKOUT_SUPPORTED_CITY,
  type CheckoutPayload,
  checkoutPayloadSchema,
  type CheckoutPaymentMethodDefinition,
  submitCheckoutRequest,
} from "@/features/checkout";
import { toUserMessage } from "@/lib/errors/error-messages";
import { notify } from "@/lib/notify";
import { testIds } from "@/lib/test-selectors";

type CheckoutPageClientProps = {
  cart: CartSummary;
  shipping: number;
  allowSubmit: boolean;
  paymentMethods: CheckoutPaymentMethodDefinition[];
  initialCustomer: {
    fullName: string;
    email: string;
    phone: string;
  };
};

export function CheckoutPageClient({
  cart,
  shipping,
  allowSubmit,
  paymentMethods,
  initialCustomer,
}: CheckoutPageClientProps) {
  const router = useRouter();
  const defaultPaymentMethod = paymentMethods[0]?.code ?? "COD";

  const form = useAppForm<CheckoutPayload>({
    schema: checkoutPayloadSchema,
    defaultValues: {
      cartId: cart.id,
      customer: {
        fullName: initialCustomer.fullName,
        email: initialCustomer.email,
        phone: initialCustomer.phone,
      },
      shippingAddress: {
        addressLine1: "",
        addressLine2: "",
        city: CHECKOUT_SUPPORTED_CITY,
        province: CHECKOUT_FIXED_PROVINCE,
        country: "Pakistan",
        postcode: "",
      },
      paymentMethod: defaultPaymentMethod,
      notes: "",
    },
  });

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<CheckoutPayload | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [retryPending, setRetryPending] = useState(false);

  const isPending = form.formState.isSubmitting || retryPending;

  const totals = useMemo(
    () => ({
      subtotal: cart.subtotal,
      shipping,
      total: cart.subtotal + shipping,
    }),
    [cart.subtotal, shipping],
  );

  async function submitCheckout(payload: CheckoutPayload, options: { manual?: boolean } = {}) {
    if (retryPending || submitted) {
      return;
    }

    form.clearErrors("root");
    setSuccessMessage(null);

    if (options.manual) {
      setRetryPending(true);
    }

    try {
      const order = await submitCheckoutRequest(payload);
      const paymentMessage = order.payment.message ?? "Order placed.";
      const total = order.totals.total;
      const confirmationUrl = order.confirmationUrl;

      setRetryPayload(null);
      setSuccessMessage(`${paymentMessage} Total payable: Rs. ${total.toLocaleString("en-PK")}.`);
      notify.success("Order placed", paymentMessage);
      setSubmitted(true);
      window.dispatchEvent(new Event("cart:changed"));

      if (confirmationUrl) {
        router.push(confirmationUrl);
      }
    } catch (error) {
      const message = toUserMessage(error);
      setSuccessMessage(null);
      setRetryPayload(payload);
      form.setError("root.serverError", {
        type: "server",
        message,
      });
      notify.error("Checkout failed", message);
    } finally {
      if (options.manual) {
        setRetryPending(false);
      }
    }
  }

  const handleCheckoutSubmit = async (payload: CheckoutPayload) => {
    await submitCheckout(payload);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit(handleCheckoutSubmit)}
        noValidate
        data-testid={testIds.storefront.checkoutForm}
      >
        <FormErrorSummary errors={form.formState.errors} title="Checkout details need attention" />

        {successMessage ? (
          <Card className="border-emerald-500/40 bg-emerald-500/5">
            <CardContent className="p-4 text-sm text-emerald-800">
              {successMessage}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Customer info</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending || submitted}
                fieldConfig={{
                  id: "checkout-full-name",
                  name: "customer.fullName",
                  type: "text",
                  label: "Full name",
                  autoComplete: "name",
                  required: true,
                }}
              />
            </div>

            <DynamicFormField
              control={form.control}
              disabled={isPending || submitted}
              fieldConfig={{
                id: "checkout-email",
                name: "customer.email",
                type: "email",
                label: "Email",
                autoComplete: "email",
                required: true,
              }}
            />

            <DynamicFormField
              control={form.control}
              disabled={isPending || submitted}
              fieldConfig={{
                id: "checkout-phone",
                name: "customer.phone",
                type: "text",
                label: "Phone",
                autoComplete: "tel",
                placeholder: "03xx xxxxxxx",
                required: true,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shipping address</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending || submitted}
                fieldConfig={{
                  id: "checkout-address-line-1",
                  name: "shippingAddress.addressLine1",
                  type: "text",
                  label: "Address line 1",
                  autoComplete: "address-line1",
                  placeholder: "House, street, area",
                  required: true,
                }}
              />
            </div>

            <div className="sm:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending || submitted}
                fieldConfig={{
                  id: "checkout-address-line-2",
                  name: "shippingAddress.addressLine2",
                  type: "text",
                  label: "Address line 2",
                  description: "Optional apartment, landmark, or delivery note.",
                  autoComplete: "address-line2",
                  placeholder: "Apartment, landmark",
                }}
              />
            </div>

            <DynamicFormField
              control={form.control}
              disabled={true}
              fieldConfig={{
                id: "checkout-province",
                name: "shippingAddress.province",
                type: "text",
                label: "Province",
              }}
            />

            <DynamicFormField
              control={form.control}
              disabled={true}
              fieldConfig={{
                id: "checkout-city",
                name: "shippingAddress.city",
                type: "text",
                label: "City",
                description: "Delivery is currently available only in Karachi.",
              }}
            />

            <DynamicFormField
              control={form.control}
              disabled={isPending || submitted}
              fieldConfig={{
                id: "checkout-postcode",
                name: "shippingAddress.postcode",
                type: "text",
                label: "Postal code",
                inputMode: "numeric",
                placeholder: "75500",
                required: true,
              }}
            />

            <DynamicFormField
              control={form.control}
              disabled={true}
              fieldConfig={{
                id: "checkout-country",
                name: "shippingAddress.country",
                type: "text",
                label: "Country",
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Controller
              control={form.control}
              name="paymentMethod"
              render={({ field, fieldState }) => (
                <Field data-invalid={Boolean(fieldState.error)}>
                  <FieldLabel>Payment method</FieldLabel>
                  <FieldContent className="space-y-3">
                    {paymentMethods.map((method) => (
                      <label
                        key={method.code}
                        className="border-border/70 flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                      >
                        <input
                          type="radio"
                          name={field.name}
                          value={method.code}
                          checked={field.value === method.code}
                          onChange={() => field.onChange(method.code)}
                          onBlur={field.onBlur}
                          disabled={isPending || submitted}
                        />
                        <span className="space-y-0.5 text-sm">
                          <span className="text-foreground block font-medium">{method.label}</span>
                          <span className="text-muted-foreground block">{method.description}</span>
                        </span>
                      </label>
                    ))}
                    <FieldError
                      {...(fieldState.error?.message
                        ? { errors: [{ message: fieldState.error.message }] }
                        : {})}
                    />
                  </FieldContent>
                </Field>
              )}
            />

            <DynamicFormField
              control={form.control}
              disabled={isPending || submitted}
              fieldConfig={{
                id: "checkout-notes",
                name: "notes",
                type: "textarea",
                label: "Order notes",
                description: "Delivery instructions.",
                placeholder: "Any delivery instructions",
                rows: 3,
              }}
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            size="lg"
            disabled={isPending || submitted || !allowSubmit}
            data-testid={testIds.storefront.checkoutSubmit}
          >
            {isPending ? "Submitting..." : "Confirm checkout details"}
          </Button>

          {retryPayload ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void submitCheckout(retryPayload, { manual: true })}
              disabled={isPending || submitted || !allowSubmit}
            >
              Retry last attempt
            </Button>
          ) : null}

          {!allowSubmit ? (
            <FieldDescription>
              Checkout is temporarily unavailable for the current cart.
            </FieldDescription>
          ) : null}
        </div>
      </form>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Order summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Items</span>
            <span>{cart.itemCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <PriceDisplay amount={totals.subtotal} size="sm" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <PriceDisplay amount={totals.shipping} size="sm" />
          </div>
          <div className="border-border/70 flex items-center justify-between border-t pt-3 font-semibold">
            <span>Total</span>
            <PriceDisplay amount={totals.total} size="sm" />
          </div>
          <p className="text-muted-foreground text-xs">
            Shipping is fixed at Rs. 150 for Karachi deliveries.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
