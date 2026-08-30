// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { useAppForm, useServerActionSubmit } from "@/components/forms";
import { AdminCategoryForm } from "@/features/admin/categories/components/admin-category-form";

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminCategoryForm", () => {
  it("does not turn a redirect-style success into a server error", async () => {
    const user = userEvent.setup();
    const actionMock = vi.fn().mockRejectedValue({
      digest: "NEXT_REDIRECT;push;/admin/categories?notice=created;307;",
    });

    function RedirectHarness() {
      const form = useAppForm({
        schema: z.object({
          name: z.string().min(1),
        }),
        defaultValues: {
          name: "Home Care",
        },
      });
      const { submitWithAction } = useServerActionSubmit(form);

      return (
        <div>
          <button
            type="button"
            onClick={() => {
              const formData = new FormData();
              formData.set("name", "Home Care");
              void submitWithAction(actionMock, formData).catch(() => undefined);
            }}
          >
            Trigger redirect
          </button>

          {form.formState.errors.root?.serverError?.message ? (
            <p>{form.formState.errors.root.serverError.message}</p>
          ) : null}
        </div>
      );
    }

    render(<RedirectHarness />);

    await user.click(screen.getByRole("button", { name: /trigger redirect/i }));

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText(/something went wrong on our side/i)).toBeNull();
  });

  it(
    "validates on change and includes category and SEO image fields in payload",
    { timeout: 20000 },
    async () => {
      const user = userEvent.setup();
      const actionMock = vi.fn().mockResolvedValue(undefined);

      render(
        <AdminCategoryForm
          action={actionMock}
          submitLabel="Create category"
          returnTo="/admin/categories"
        />,
      );

      await user.clear(screen.getByLabelText(/name/i));
      await user.type(screen.getByLabelText(/name/i), "Home Care");
      await user.clear(screen.getByLabelText(/slug/i));
      await user.type(screen.getByLabelText(/slug/i), "home-care");
      await user.type(
        screen.getByLabelText(/category card image/i),
        "https://cdn.example.com/categories/home-care.jpg",
      );
      await user.type(
        screen.getByLabelText(/^og image$/i),
        "https://cdn.example.com/seo/home-care-og.jpg",
      );

      await user.click(screen.getByRole("button", { name: /create category/i }));

      await waitFor(() => {
        expect(actionMock).toHaveBeenCalledTimes(1);
      });

      const payload = actionMock.mock.calls[0]?.[0];

      expect(payload).toBeInstanceOf(FormData);
      expect(payload.get("name")).toBe("Home Care");
      expect(payload.get("slug")).toBe("home-care");
      expect(payload.get("status")).toBe("DRAFT");
      expect(payload.get("returnTo")).toBe("/admin/categories");
      expect(payload.get("categoryCardImageUrl")).toBe(
        "https://cdn.example.com/categories/home-care.jpg",
      );
      expect(payload.get("seoImageUrl")).toBe("https://cdn.example.com/seo/home-care-og.jpg");
    },
  );
});
