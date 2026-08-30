import { describe, expect,it } from "vitest";

import { notificationEventTypes } from "@/features/notifications/contracts";
import { buildNotificationPlan } from "@/features/notifications/templates";

describe("contact form notifications", () => {
  const mockRecipients = {
    adminEmails: ["admin@example.com", "support@example.com"],
    telegramChatId: "123456789",
  };

  it("creates notification plan for contact form submission", () => {
    const event = {
      type: notificationEventTypes.contactFormSubmitted,
      payload: {
        fullName: "John Doe",
        email: "john@example.com",
        subject: "Product inquiry",
        messagePreview: "I have a question about your products.",
      },
    } as const;

    const plan = buildNotificationPlan(event, mockRecipients);

    expect(plan.eventType).toBe("contact.form-submitted");
    expect(plan.deliveries).toHaveLength(2); // Email + Telegram

    // Check email delivery
    const emailDelivery = plan.deliveries.find((d) => d.channel === "email");
    expect(emailDelivery).toBeDefined();
    expect(emailDelivery?.audience).toBe("admin");
    expect(emailDelivery?.recipient).toEqual(mockRecipients.adminEmails);
    expect(emailDelivery?.message.subject).toContain("New Contact");
    expect(emailDelivery?.message.subject).toContain("Product inquiry");
    expect(emailDelivery?.message.text).toContain("John Doe");
    expect(emailDelivery?.message.text).toContain("john@example.com");
    expect(emailDelivery?.message.text).toContain("I have a question about your products.");

    // Check Telegram delivery
    const telegramDelivery = plan.deliveries.find((d) => d.channel === "telegram");
    expect(telegramDelivery).toBeDefined();
    expect(telegramDelivery?.audience).toBe("admin");
    expect(telegramDelivery?.recipient).toBe(mockRecipients.telegramChatId);
    expect(telegramDelivery?.message.subject).toContain("New Contact");
    expect(telegramDelivery?.message.text).toContain("John Doe");
  });

  it("includes message preview in notification text", () => {
    const event = {
      type: notificationEventTypes.contactFormSubmitted,
      payload: {
        fullName: "Jane Smith",
        email: "jane@example.com",
        subject: "Urgent support request",
        messagePreview: "My order has not arrived and it's been 2 weeks.",
      },
    } as const;

    const plan = buildNotificationPlan(event, mockRecipients);

    const emailDelivery = plan.deliveries.find((d) => d.channel === "email");
    expect(emailDelivery?.message.text).toContain(
      "My order has not arrived and it's been 2 weeks.",
    );
  });

  it("creates no deliveries when admin recipients are not configured", () => {
    const event = {
      type: notificationEventTypes.contactFormSubmitted,
      payload: {
        fullName: "John Doe",
        email: "john@example.com",
        subject: "Product inquiry",
        messagePreview: "I have a question.",
      },
    } as const;

    const plan = buildNotificationPlan(event, {
      adminEmails: [],
    });

    expect(plan.deliveries).toHaveLength(0);
  });

  it("creates only email delivery when Telegram is not configured", () => {
    const event = {
      type: notificationEventTypes.contactFormSubmitted,
      payload: {
        fullName: "John Doe",
        email: "john@example.com",
        subject: "Product inquiry",
        messagePreview: "I have a question.",
      },
    } as const;

    const plan = buildNotificationPlan(event, {
      adminEmails: ["admin@example.com"],
    });

    expect(plan.deliveries).toHaveLength(1);
    expect(plan.deliveries[0]?.channel).toBe("email");
  });

  it("creates only Telegram delivery when admin emails are not configured", () => {
    const event = {
      type: notificationEventTypes.contactFormSubmitted,
      payload: {
        fullName: "John Doe",
        email: "john@example.com",
        subject: "Product inquiry",
        messagePreview: "I have a question.",
      },
    } as const;

    const plan = buildNotificationPlan(event, {
      adminEmails: [],
      telegramChatId: "123456789",
    });

    expect(plan.deliveries).toHaveLength(1);
    expect(plan.deliveries[0]?.channel).toBe("telegram");
  });
});
