// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as ReactTypes from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RECENT_SEARCHES_STORAGE_KEY } from "@/features/catalog/recent-searches";
import {
  __resetSearchDialogStateForTests,
  openSearchDialog,
} from "@/features/catalog/search-dialog-state";
import type { CatalogProductCard, CatalogSearchResponse } from "@/features/catalog/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/image", () => ({
  default: function MockNextImage(props: ComponentPropsWithoutRef<"img">) {
    const { fill, ...imgProps } = props as ComponentPropsWithoutRef<"img"> & {
      fill?: boolean;
    };
    void fill;

    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element -- intentional test double for next/image
    return <img {...imgProps} />;
  },
}));

// Lightweight command-dialog doubles: exercise the search dialog logic (state,
// debounce, fetch, rendering) without pulling Radix/cmdk into the jsdom suite.
vi.mock("@/components/ui/command", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factories are hoisted above imports, so require is required here.
  const React = require("react") as typeof ReactTypes;

  return {
    CommandDialog: ({
      open,
      title,
      description,
      children,
    }: {
      open?: boolean;
      title?: string;
      description?: string;
      children?: ReactNode;
    }) =>
      open ? (
        <div role="dialog" aria-label={title}>
          <p>{description}</p>
          {children}
        </div>
      ) : null,
    CommandInput: (props: {
      value?: string;
      placeholder?: string;
      "aria-label"?: string;
      onValueChange?: (value: string) => void;
      onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    }) => (
      <input
        aria-label={props["aria-label"]}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(event) => props.onValueChange?.(event.target.value)}
        onKeyDown={props.onKeyDown}
      />
    ),
    CommandList: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    CommandGroup: ({
      heading,
      children,
    }: {
      heading?: string;
      children?: ReactNode;
    }) => (
      <div>
        {heading ? <p>{heading}</p> : null}
        {children}
      </div>
    ),
    CommandItem: ({
      children,
      onSelect,
      value,
      ...props
    }: {
      children?: ReactNode;
      onSelect?: () => void;
      value?: string;
    }) => (
      <div role="option" aria-selected={false} data-value={value} onClick={() => onSelect?.()} {...props}>
        {children}
      </div>
    ),
    CommandSeparator: () => <hr />,
  };
});

const fetchMock = vi.fn();

function makeSearchCard(overrides: Partial<CatalogProductCard> = {}): CatalogProductCard {
  return {
    id: "prod-1",
    slug: "daily-face-wash",
    name: "Daily Face Wash",
    description: "Gentle daily cleanser.",
    categorySlug: "personal-care",
    price: 280,
    inventoryQuantity: 12,
    averageRating: 4.6,
    reviewCount: 18,
    imageLabel: "Daily Face Wash",
    imageTone: "rose",
    attributeSummary: ["Foam", "100ml"],
    href: "/categories/personal-care/daily-face-wash",
    ...overrides,
  };
}

function mockSearchPayload(items: CatalogProductCard[]): CatalogSearchResponse {
  return {
    query: "fa",
    total: items.length,
    items,
    source: "db",
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
  openSearchDialog();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  __resetSearchDialogStateForTests();
});

describe("CatalogSearchCommandDialog", () => {
  it("shows recent and popular searches as the landing view when the query is empty", async () => {
    window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(["rice", "face wash"]));

    const { CatalogSearchCommandDialog } = await import(
      "@/features/catalog/components/catalog-search-command-dialog"
    );
    render(<CatalogSearchCommandDialog />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Recent searches")).toBeInTheDocument();
    expect(screen.getByText("Popular searches")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /rice/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /tumbler/i })).toBeInTheDocument();
  });

  it("wraps the popular searches group so it is hidden on mobile", async () => {
    const { CatalogSearchCommandDialog } = await import(
      "@/features/catalog/components/catalog-search-command-dialog"
    );
    render(<CatalogSearchCommandDialog />);

    const popularHeading = screen.getByText("Popular searches");
    // Parent wrapper carries the responsive hide-on-mobile classes.
    expect(popularHeading.parentElement?.parentElement).toHaveClass("hidden");
    expect(popularHeading.parentElement?.parentElement).toHaveClass("md:block");
  });

  it("hides the recent/popular landing groups and renders live results after searching", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () =>
        mockSearchPayload([
          makeSearchCard({ imageUrl: "/uploads/catalog/daily-face-wash.png" }),
        ]),
    });

    const { CatalogSearchCommandDialog } = await import(
      "@/features/catalog/components/catalog-search-command-dialog"
    );
    const user = userEvent.setup();
    render(<CatalogSearchCommandDialog />);

    await user.type(screen.getByRole("textbox", { name: /search products/i }), "fa");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText("Daily Face Wash")).toBeInTheDocument();
    });

    expect(screen.queryByText("Recent searches")).not.toBeInTheDocument();
    expect(screen.queryByText("Popular searches")).not.toBeInTheDocument();
  });

  it("renders product image, name, and price underneath in each result row", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () =>
        mockSearchPayload([
          makeSearchCard({ imageUrl: "/uploads/catalog/daily-face-wash.png" }),
        ]),
    });

    const { CatalogSearchCommandDialog } = await import(
      "@/features/catalog/components/catalog-search-command-dialog"
    );
    const user = userEvent.setup();
    render(<CatalogSearchCommandDialog />);

    await user.type(screen.getByRole("textbox", { name: /search products/i }), "fa");

    expect(
      await screen.findByRole("img", { name: /daily face wash product image/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Daily Face Wash")).toBeInTheDocument();
    expect(screen.getByText("Rs. 280")).toBeInTheDocument();
  });

  it("renders a fallback placeholder when a result has no image", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () =>
        mockSearchPayload([makeSearchCard({ imageLabel: "Face Wash Art" })]),
    });

    const { CatalogSearchCommandDialog } = await import(
      "@/features/catalog/components/catalog-search-command-dialog"
    );
    const user = userEvent.setup();
    render(<CatalogSearchCommandDialog />);

    await user.type(screen.getByRole("textbox", { name: /search products/i }), "fa");

    expect(await screen.findByText("Daily Face Wash")).toBeInTheDocument();
    expect(screen.getByText("Face Wash Art")).toBeInTheDocument();
  });

  it("shows a loading state while the first request is in flight", async () => {
    let resolveFetch: (value: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { CatalogSearchCommandDialog } = await import(
      "@/features/catalog/components/catalog-search-command-dialog"
    );
    const user = userEvent.setup();
    render(<CatalogSearchCommandDialog />);

    await user.type(screen.getByRole("textbox", { name: /search products/i }), "fa");

    // The 280ms debounce must elapse and the request must start before the
    // loading state is visible.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Searching products")).toBeInTheDocument();

    resolveFetch!({
      ok: true,
      json: async () =>
        mockSearchPayload([
          makeSearchCard({ imageUrl: "/uploads/catalog/daily-face-wash.png" }),
        ]),
    } as Response);

    await waitFor(() => {
      expect(screen.getByText("Daily Face Wash")).toBeInTheDocument();
    });
  });

  it("shows a friendly empty state when no products match", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mockSearchPayload([]),
    });

    const { CatalogSearchCommandDialog } = await import(
      "@/features/catalog/components/catalog-search-command-dialog"
    );
    const user = userEvent.setup();
    render(<CatalogSearchCommandDialog />);

    await user.type(screen.getByRole("textbox", { name: /search products/i }), "zz");

    expect(await screen.findByText("No products found")).toBeInTheDocument();
    expect(screen.getByText(/no products matched/i)).toBeInTheDocument();
  });

  it("shows an error state with retry when the search request fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    const { CatalogSearchCommandDialog } = await import(
      "@/features/catalog/components/catalog-search-command-dialog"
    );
    const user = userEvent.setup();
    render(<CatalogSearchCommandDialog />);

    await user.type(screen.getByRole("textbox", { name: /search products/i }), "fa");

    expect(
      await screen.findByText(/search is temporarily unavailable/i),
    ).toBeInTheDocument();

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () =>
        mockSearchPayload([
          makeSearchCard({ imageUrl: "/uploads/catalog/daily-face-wash.png" }),
        ]),
    });

    await user.click(screen.getByRole("button", { name: /retry search/i }));

    await waitFor(() => {
      expect(screen.getByText("Daily Face Wash")).toBeInTheDocument();
    });
  });

  it("records a recent search when Enter is pressed with a valid query", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mockSearchPayload([makeSearchCard()]),
    });

    const { CatalogSearchCommandDialog } = await import(
      "@/features/catalog/components/catalog-search-command-dialog"
    );
    const user = userEvent.setup();
    render(<CatalogSearchCommandDialog />);

    const input = screen.getByRole("textbox", { name: /search products/i });
    await user.type(input, "face wash");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY)).toContain("face wash");
    });
  });

  it("replays a recent search when one is selected", async () => {
    window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(["rice"]));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mockSearchPayload([makeSearchCard()]),
    });

    const { CatalogSearchCommandDialog } = await import(
      "@/features/catalog/components/catalog-search-command-dialog"
    );
    const user = userEvent.setup();
    render(<CatalogSearchCommandDialog />);

    await user.click(screen.getByRole("option", { name: /rice/i }));

    expect(screen.getByRole("textbox", { name: /search products/i })).toHaveValue("rice");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("removes a single recent search and clears all", async () => {
    window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(["rice", "face wash"]));

    const { CatalogSearchCommandDialog } = await import(
      "@/features/catalog/components/catalog-search-command-dialog"
    );
    const user = userEvent.setup();
    render(<CatalogSearchCommandDialog />);

    await user.click(screen.getByRole("button", { name: /remove rice from recent searches/i }));
    expect(screen.queryByRole("option", { name: /rice/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /clear all recent searches/i }));
    expect(screen.getByText(/no recent searches yet/i)).toBeInTheDocument();
  });
});
