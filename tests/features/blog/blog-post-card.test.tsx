// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BlogPostCard } from "@/features/blog/components/blog-post-card";
import type { BlogListingItem } from "@/features/blog/types";

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

function makePost(overrides: Partial<BlogListingItem> = {}): BlogListingItem {
  return {
    id: "post-1",
    locale: "en",
    title: "Budget-friendly pantry planning",
    slug: "budget-friendly-pantry-planning",
    excerpt: "Practical steps to reduce weekly grocery waste.",
    coverImage: {
      src: "https://cdn.example.com/blog/pantry.jpg",
      alt: "Pantry shelves with labels",
      width: 1280,
      height: 720,
    },
    status: "published",
    publishedAt: "2026-04-18T10:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("BlogPostCard semantics", () => {
  it("renders one canonical link for the full card", () => {
    render(<BlogPostCard post={makePost()} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/blog/budget-friendly-pantry-planning");
  });

  it("renders published date using a time element", () => {
    render(<BlogPostCard post={makePost()} />);

    const time = screen.getByText(/apr/i).closest("time");
    expect(time).toBeInTheDocument();
    expect(time).toHaveAttribute("datetime", "2026-04-18T10:00:00.000Z");
  });

  it("applies responsive sizes for the two-column blog grid layout", () => {
    render(<BlogPostCard post={makePost()} />);

    const image = screen.getByRole("img", { name: "Pantry shelves with labels" });
    expect(image).toHaveAttribute("sizes", "(max-width: 767px) 100vw, 50vw");
  });
});
