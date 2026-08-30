// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toasterMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  Toaster: (props: unknown) => {
    toasterMock(props);
    return <div data-testid="mock-sonner-toaster" />;
  },
}));

describe("AppToaster", () => {
  beforeEach(() => {
    toasterMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("always renders in the fixed light theme", async () => {
    const { AppToaster } = await import("@/components/providers/app-toaster");

    render(<AppToaster />);

    expect(screen.getByTestId("mock-sonner-toaster")).toBeInTheDocument();
    expect(toasterMock).toHaveBeenCalledTimes(1);

    const toasterProps = toasterMock.mock.calls[0]?.[0] as {
      theme?: string;
      toastOptions?: {
        actionButtonStyle?: { background?: string };
        cancelButtonStyle?: { background?: string };
        classNames?: {
          actionButton?: string;
          cancelButton?: string;
        };
      };
    };

    expect(toasterProps.theme).toBe("light");
    expect(toasterProps.toastOptions?.actionButtonStyle?.background).toBe("#2b1735");
    expect(toasterProps.toastOptions?.cancelButtonStyle?.background).toBe("#977aa1");
    expect(toasterProps.toastOptions?.classNames?.actionButton).toContain("bg-primary");
    expect(toasterProps.toastOptions?.classNames?.cancelButton).toContain("border");
  });
});
