// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CheckoutPageClient } from "@/features/checkout/components/checkout-page-client";

const {
  pushMock,
  notifySuccessMock,
  notifyErrorMock,
  notifyWarningMock,
  notifyInfoMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  notifySuccessMock: vi.fn(),
  notifyErrorMock: vi.fn(),
  notifyWarningMock: vi.fn(),
  notifyInfoMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: notifySuccessMock,
    error: notifyErrorMock,
    warning: notifyWarningMock,
    info: notifyInfoMock,
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
    notifyWarningMock.mockReset();
    notifyInfoMock.mockReset();
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

    await user.type(screen.getByLabelText(/^address/i), "123 Main Street");
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

  it("submits checkout without a postal code", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        order: {
          confirmationUrl: "/checkout/confirmation/OD-1003",
          orderNumber: "OD-1003",
          payment: { message: "Cash on delivery confirmed." },
          totals: { total: 1350 },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

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

    await user.type(screen.getByLabelText(/^address/i), "123 Main Street");
    await user.click(screen.getByRole("button", { name: /confirm checkout details/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const request = fetchMock.mock.calls[0];
    const payload = JSON.parse(request?.[1]?.body as string);

    expect(payload.shippingAddress).toMatchObject({
      addressLine1: "123 Main Street",
      city: "Karachi",
      province: "Sindh",
      country: "Pakistan",
    });
    // The form resolver normalizes an empty postal code away, so the payload
    // omits it entirely and the server treats it as optional.
    expect(payload.shippingAddress.postcode).toBeUndefined();
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

    await user.type(screen.getByLabelText(/^address/i), "123 Main Street");
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

function renderCheckout(overrides: { isAuthenticated?: boolean } = {}) {
  return render(
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
      isAuthenticated={overrides.isAuthenticated ?? false}
    />,
  );
}

describe("checkout save address", () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("PointerEvent", class PointerEventMock extends MouseEvent {});
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();
    window.HTMLElement.prototype.setPointerCapture = vi.fn();

    pushMock.mockReset();
    notifySuccessMock.mockReset();
    notifyErrorMock.mockReset();
    notifyWarningMock.mockReset();
    notifyInfoMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("hides the save controls for guests and shows them for signed-in customers", () => {
    const { rerender } = renderCheckout({ isAuthenticated: false });

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /manage saved addresses/i }),
    ).not.toBeInTheDocument();

    rerender(
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
        isAuthenticated={true}
      />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage saved addresses/i }),
    ).toHaveAttribute("href", "/account/addresses");
  });

  it("saves the current address to the user's saved addresses", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        created: true,
        address: { id: "address-1", addressLine1: "123 Main Street" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderCheckout({ isAuthenticated: true });

    await user.type(screen.getByLabelText(/^address/i), "123 Main Street");
    await user.type(screen.getByLabelText(/postal code/i), "75500");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("/api/addresses");
    expect(request?.[1]?.method).toBe("POST");
    const payload = JSON.parse(request?.[1]?.body as string);
    expect(payload).toMatchObject({
      addressLine1: "123 Main Street",
      city: "Karachi",
      province: "Sindh",
      country: "Pakistan",
      postcode: "75500",
      phone: "03001234567",
    });

    expect(notifySuccessMock).toHaveBeenCalledWith(
      "Address saved",
      "You can change your address anytime from Addresses in your profile.",
    );
  });

  it("warns instead of saving when the address is incomplete", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderCheckout({ isAuthenticated: true });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(notifyWarningMock).toHaveBeenCalledWith(
        "Address incomplete",
        "Please fill in the required address fields before saving.",
      );
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the save address tooltip explaining where addresses live", async () => {
    const user = userEvent.setup();

    renderCheckout({ isAuthenticated: true });

    await user.hover(screen.getByRole("button", { name: "Save" }));

    // Radix renders the tooltip text both visually and in a visually-hidden
    // accessibility copy, so match all occurrences.
    const tooltipTexts = await screen.findAllByText(/save the address to use for later orders/i);
    expect(tooltipTexts.length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/you can change your address from addresses inside profile/i).length,
    ).toBeGreaterThan(0);
  });

  it("pre-fills the shipping address and phone from the saved default address", () => {
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
        isAuthenticated={true}
        initialShippingAddress={{
          addressLine1: "House 1, Street 2",
          city: "Karachi",
          province: "Sindh",
          country: "Pakistan",
          postcode: "75500",
        }}
      />,
    );

    expect(screen.getByLabelText(/^address/i)).toHaveValue("House 1, Street 2");
    expect(screen.getByLabelText(/postal code/i)).toHaveValue("75500");
    expect(screen.getByLabelText(/^phone/i)).toHaveValue("03001234567");
  });

  it("leaves the address fields empty when no saved address is available", () => {
    renderCheckout({ isAuthenticated: true });

    expect(screen.getByLabelText(/^address/i)).toHaveValue("");
    expect(screen.getByLabelText(/postal code/i)).toHaveValue("");
  });
});
