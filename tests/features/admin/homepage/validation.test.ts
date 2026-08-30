import { describe, expect, it } from "vitest";

import {
  validateAdminBannerInput,
  validateAdminDealCampaignInput,
  validateAdminHomepageSectionInput,
} from "@/features/admin/homepage";

describe("admin homepage content validation", () => {
  it("accepts section ordering, toggles, scheduling, and valid announcement content", () => {
    const result = validateAdminHomepageSectionInput({
      id: "section-1",
      key: "announcement-primary",
      title: "Announcement",
      type: "announcement-bar",
      position: 5,
      active: true,
      startAt: "2026-04-20T08:00:00.000Z",
      endAt: "2026-04-22T18:00:00.000Z",
      content: {
        message: "Free delivery on orders over Rs. 2,000",
        href: "/categories",
        label: "Browse deals",
      },
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.position).toBe(5);
      expect(result.data.type).toBe("announcement-bar");
      expect(result.data.active).toBe(true);
    }
  });

  it("rejects invalid schedules and malformed section payloads", () => {
    const result = validateAdminHomepageSectionInput({
      id: "section-2",
      key: "deal-primary",
      title: "Broken deal",
      type: "deal-spotlight",
      position: 40,
      active: true,
      startAt: "2026-04-25T08:00:00.000Z",
      endAt: "2026-04-20T08:00:00.000Z",
      content: {
        description: "",
        dealLabel: "Flash deal",
        price: 999,
        compareAt: 1299,
        ctaLabel: "View deal",
        ctaHref: "/categories",
      },
    });

    expect(result.success).toBe(false);
  });

  it("validates banner and campaign scheduling consistently", () => {
    const banner = validateAdminBannerInput({
      title: "Weekend banner",
      imageUrl: "https://example.com/banner.jpg",
      href: "/categories",
      position: 1,
      active: true,
      startAt: "2026-04-20T08:00:00.000Z",
      endAt: "2026-04-21T08:00:00.000Z",
    });
    const campaign = validateAdminDealCampaignInput({
      name: "Flash deal",
      description: "Limited-time savings",
      price: 1499,
      compareAt: 1899,
      targetHref: "/categories/party-heaven",
      imageUrl: "https://store.public.blob.vercel-storage.com/admin/content/campaign-deal.png",
      imageAlt: "Campaign spotlight deal image",
      startsAt: "2026-04-20T08:00:00.000Z",
      endsAt: "2026-04-21T08:00:00.000Z",
      active: true,
    });

    expect(banner.success).toBe(true);
    expect(campaign.success).toBe(true);
  });

  it("rejects campaign compare-at lower than campaign price", () => {
    const campaign = validateAdminDealCampaignInput({
      name: "Flash deal",
      price: 2000,
      compareAt: 1800,
      active: true,
    });

    expect(campaign.success).toBe(false);
  });

  it("requires campaign image alt text when image URL is provided", () => {
    const result = validateAdminDealCampaignInput({
      name: "Flash deal",
      imageUrl: "https://store.public.blob.vercel-storage.com/admin/content/campaign-deal.png",
      active: true,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported campaign image hosts", () => {
    const result = validateAdminDealCampaignInput({
      name: "Flash deal",
      imageUrl: "https://images.example.com/campaign.jpg",
      imageAlt: "Campaign image",
      active: true,
    });

    expect(result.success).toBe(false);
  });

  it("accepts deal spotlight image fields on configured hosts", () => {
    const dealResult = validateAdminHomepageSectionInput({
      key: "deal-with-image",
      title: "Deal with image",
      type: "deal-spotlight",
      position: 40,
      active: true,
      content: {
        description: "Save on best sellers this week.",
        dealLabel: "Flash deal",
        price: 999,
        compareAt: 1299,
        ctaLabel: "View deal",
        ctaHref: "/categories",
        image: {
          url: "/blog/deal-spotlight.jpg",
          alt: "Featured products highlighted for a limited-time sale",
        },
      },
    });

    expect(dealResult.success).toBe(true);
  });

  it("rejects unsupported deal image hosts", () => {
    const dealResult = validateAdminHomepageSectionInput({
      key: "deal-invalid-image",
      title: "Deal invalid image",
      type: "deal-spotlight",
      position: 40,
      active: true,
      content: {
        description: "Save on best sellers this week.",
        dealLabel: "Flash deal",
        price: 999,
        compareAt: 1299,
        ctaLabel: "View deal",
        ctaHref: "/categories",
        image: {
          url: "https://images.example.com/deal.jpg",
          alt: "Deal image",
        },
      },
    });

    expect(dealResult.success).toBe(false);
  });
});
