// @vitest-environment jsdom

import type { ReactNode } from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/components/providers/theme-provider";

const nextThemesProviderMock = vi.hoisted(() => vi.fn());

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children, ...props }: { children: ReactNode }) => {
    nextThemesProviderMock(props);
    return <div data-testid="mock-next-themes-provider">{children}</div>;
  },
}));

describe("ThemeProvider", () => {
  afterEach(() => {
    cleanup();
    nextThemesProviderMock.mockReset();
  });

  it("defaults to light theme while keeping system and dark support available", () => {
    render(
      <ThemeProvider>
        <span>child content</span>
      </ThemeProvider>,
    );

    expect(screen.getByText("child content")).toBeInTheDocument();
    expect(nextThemesProviderMock).toHaveBeenCalledTimes(1);
    expect(nextThemesProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attribute: "class",
        defaultTheme: "light",
        disableTransitionOnChange: true,
        enableSystem: true,
        storageKey: "party-heaven-theme",
        themes: ["light", "dark", "system"],
      }),
    );
  });

  it("allows explicit provider overrides without breaking theme switching", () => {
    render(
      <ThemeProvider defaultTheme="dark" enableSystem={false}>
        <span>override content</span>
      </ThemeProvider>,
    );

    expect(screen.getByText("override content")).toBeInTheDocument();
    expect(nextThemesProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTheme: "dark",
        enableSystem: false,
      }),
    );
  });
});
