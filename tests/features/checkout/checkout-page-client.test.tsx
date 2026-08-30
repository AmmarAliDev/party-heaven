// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
const notifySuccessMock = vi.fn();
const notifyErrorMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: notifySuccessMock,
    error: notifyErrorMock,
  },
}));

type MockCheckoutResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

describe("checkout form migration", () => {
  beforeEach(() => {
    pushMock.mockReset();
    notifySuccessMock.mockReset();
    notifyErrorMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("validates checkout fields on change before submission", async () => {
    const user = userEvent.setup();
    const { CheckoutPageClient } = await import("@/features/checkout/components/checkout-page-client");

    render(
      <CheckoutPageClient
        cart={{
          id: "cart-1",
          token: "guest-cart-token",
          items: [],
          dealItems: [],
          itemCount: 1,
          subtotal: 1200,
        }}
        shipping={150}
        allowSubmit={true}
        paymentMethods={[
          {
            code: "COD",
            label: "Cash on delivery",
            description: "Pay when your order arrives.",
            type: "offline",
            enabled: true,
          },
        ]}
        initialCustomer={{
          fullName: "",
          email: "",
          phone: "",
        }}
      />,
    );

    await user.type(screen.getByLabelText(/email/i), "bad-email");

    await waitFor(() => {
      expect(screen.getAllByText(/valid email address/i).length).toBeGreaterThan(0);
    });
  });

  it("submits the same checkout payload shape after valid input", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        order: {
          confirmationUrl: "/checkout/confirmation/OD-1001",
          orderNumber: "OD-1001",
          payment: { message: "Cash on delivery confirmed." },
          totals: { total: 1350 },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { CheckoutPageClient } = await import("@/features/checkout/components/checkout-page-client");

    render(
      <CheckoutPageClient
        cart={{
          id: "cart-1",
          token: "guest-cart-token",
          items: [],
          dealItems: [],
          itemCount: 1,
          subtotal: 1200,
        }}
        shipping={150}
        allowSubmit={true}
        paymentMethods={[
          {
            code: "COD",
            label: "Cash on delivery",
            description: "Pay when your order arrives.",
            type: "offline",
            enabled: true,
          },
        ]}
        initialCustomer={{
          fullName: "Ammar Khan",
          email: "ammar@example.com",
          phone: "03001234567",
        }}
      />,
    );

    await user.type(screen.getByLabelText(/address line 1/i), "123 Main Street");
    await user.type(screen.getByLabelText(/postal code/i), "75500");
    await user.click(screen.getByRole("button", { name: /confirm checkout details/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const request = fetchMock.mock.calls[0];
    const payload = JSON.parse(request?.[1]?.body as string);

    expect(request?.[0]).toBe("/api/checkout");
    expect(payload).toMatchObject({
      cartId: "cart-1",
      customer: {
        fullName: "Ammar Khan",
        email: "ammar@example.com",
        phone: "03001234567",
      },
      shippingAddress: {
        addressLine1: "123 Main Street",
        city: "Karachi",
        province: "Sindh",
        country: "Pakistan",
        postcode: "75500",
      },
      paymentMethod: "COD",
    });
  });

  it("prevents duplicate retry submissions while a retry is in flight", async () => {
    const user = userEvent.setup();
    let resolveRetry!: (value: MockCheckoutResponse) => void;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Checkout could not be submitted. Please try again." }),
      })
      .mockImplementationOnce(
        () =>
          new Promise<MockCheckoutResponse>((resolve) => {
            resolveRetry = resolve;
          }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { CheckoutPageClient } = await import("@/features/checkout/components/checkout-page-client");

    render(
      <CheckoutPageClient
        cart={{
          id: "cart-1",
          token: "guest-cart-token",
          items: [],
          dealItems: [],
          itemCount: 1,
          subtotal: 1200,
        }}
        shipping={150}
        allowSubmit={true}
        paymentMethods={[
          {
            code: "COD",
            label: "Cash on delivery",
            description: "Pay when your order arrives.",
            type: "offline",
            enabled: true,
          },
        ]}
        initialCustomer={{
          fullName: "Ammar Khan",
          email: "ammar@example.com",
          phone: "03001234567",
        }}
      />,
    );

    await user.type(screen.getByLabelText(/address line 1/i), "123 Main Street");
    await user.type(screen.getByLabelText(/postal code/i), "75500");
    await user.click(screen.getByRole("button", { name: /confirm checkout details/i }));

    const retryButton = await screen.findByRole("button", { name: /retry last attempt/i });

    await user.click(retryButton);

    await waitFor(() => {
      expect((retryButton as HTMLButtonElement).disabled).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    resolveRetry({
      ok: true,
      json: async () => ({
        ok: true,
        order: {
          confirmationUrl: "/checkout/confirmation/OD-1002",
          orderNumber: "OD-1002",
          payment: { message: "Cash on delivery confirmed." },
          totals: { total: 1350 },
        },
      }),
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/checkout/confirmation/OD-1002");
    });
  });
});
