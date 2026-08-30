// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { notifySuccessMock, notifyErrorMock } = vi.hoisted(() => ({
  notifySuccessMock: vi.fn(),
  notifyErrorMock: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: notifySuccessMock,
    error: notifyErrorMock,
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import type { SavedAddress } from "@/features/addresses";
import { AddressBook } from "@/features/addresses/components/address-book";

function buildAddress(overrides: Partial<SavedAddress> = {}): SavedAddress {
  return {
    id: "address-1",
    label: "Home",
    addressLine1: "House 1, Street 2",
    addressLine2: null,
    city: "Karachi",
    province: "Sindh",
    country: "Pakistan",
    postcode: "75500",
    phone: "03001234567",
    isDefault: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createFetchMock(payload: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });
}

describe("address book", () => {
  beforeAll(() => {
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
  });

  beforeEach(() => {
    notifySuccessMock.mockReset();
    notifyErrorMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lists saved addresses with the default badge", () => {
    render(
      <AddressBook
        initialAddresses={[
          buildAddress({ id: "address-1", label: "Home", isDefault: true }),
          buildAddress({
            id: "address-2",
            label: "Office",
            addressLine1: "Office 4, Plaza Road",
            isDefault: false,
          }),
        ]}
      />,
    );

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Office")).toBeInTheDocument();
    expect(screen.getAllByText("Default")).toHaveLength(1);
    expect(screen.getByText(/Office 4, Plaza Road/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add address/i })).toBeInTheDocument();
  });

  it("shows an empty state when there are no saved addresses", () => {
    render(<AddressBook initialAddresses={[]} />);

    expect(screen.getByText(/no addresses yet/i)).toBeInTheDocument();
  });

  it("adds a new address through the dialog", async () => {
    const user = userEvent.setup();
    const fetchMock = createFetchMock({
      ok: true,
      created: true,
      address: buildAddress({
        id: "new-1",
        label: "Work",
        addressLine1: "Suite 9, Gulshan",
        isDefault: false,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AddressBook initialAddresses={[]} />);

    await user.click(screen.getByRole("button", { name: /add address/i }));
    await user.type(screen.getByLabelText(/^address/i), "Suite 9, Gulshan");
    await user.type(screen.getByLabelText(/postal code/i), "75300");
    await user.click(screen.getByRole("button", { name: /save address/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("/api/addresses");
    expect(request?.[1]?.method).toBe("POST");
    const payload = JSON.parse(request?.[1]?.body as string);
    expect(payload).toMatchObject({
      addressLine1: "Suite 9, Gulshan",
      city: "Karachi",
      province: "Sindh",
      country: "Pakistan",
      postcode: "75300",
    });

    await waitFor(() => {
      expect(screen.getByText(/Suite 9, Gulshan/)).toBeInTheDocument();
    });
    expect(notifySuccessMock).toHaveBeenCalledWith(
      "Address added",
      "You can reuse this address at checkout.",
    );
  });

  it("edits an existing address through the dialog", async () => {
    const user = userEvent.setup();
    const fetchMock = createFetchMock({
      ok: true,
      address: buildAddress({
        id: "address-1",
        label: "Home",
        addressLine1: "House 5, New Street",
        isDefault: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AddressBook
        initialAddresses={[buildAddress({ id: "address-1", addressLine1: "House 1, Street 2" })]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /edit/i }));

    const line1 = screen.getByLabelText(/^address/i);
    await user.clear(line1);
    await user.type(line1, "House 5, New Street");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("/api/addresses/address-1");
    expect(request?.[1]?.method).toBe("PATCH");
    const payload = JSON.parse(request?.[1]?.body as string);
    expect(payload.addressLine1).toBe("House 5, New Street");

    await waitFor(() => {
      expect(screen.getByText(/House 5, New Street/)).toBeInTheDocument();
    });
  });

  it("removes an address after confirmation", async () => {
    const user = userEvent.setup();
    const fetchMock = createFetchMock({ ok: true, removed: true });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AddressBook
        initialAddresses={[buildAddress({ id: "address-1", addressLine1: "House 1, Street 2" })]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /remove/i }));
    await user.click(screen.getByRole("button", { name: /remove address/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("/api/addresses/address-1");
    expect(request?.[1]?.method).toBe("DELETE");

    await waitFor(() => {
      expect(screen.getByText(/no addresses yet/i)).toBeInTheDocument();
    });
    expect(notifySuccessMock).toHaveBeenCalledWith("Address removed");
  });

  it("makes an address the default", async () => {
    const user = userEvent.setup();
    const fetchMock = createFetchMock({
      ok: true,
      address: buildAddress({
        id: "address-2",
        label: "Office",
        addressLine1: "Office 4, Plaza Road",
        isDefault: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AddressBook
        initialAddresses={[
          buildAddress({ id: "address-1", label: "Home", isDefault: true }),
          buildAddress({
            id: "address-2",
            label: "Office",
            addressLine1: "Office 4, Plaza Road",
            isDefault: false,
          }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /make default/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("/api/addresses/address-2");
    expect(request?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(request?.[1]?.body as string)).toEqual({ isDefault: true });

    await waitFor(() => {
      expect(notifySuccessMock).toHaveBeenCalledWith("Default address updated");
    });
  });
});
