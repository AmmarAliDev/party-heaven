"use server";

import { headers } from "next/headers";

import { getNotificationService } from "@/features/notifications";
import { notificationEventTypes } from "@/features/notifications/contracts";
import { AppError } from "@/lib/errors/app-error";
import { createLogger } from "@/lib/logger";
import { getPrismaClient } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin, getClientIp } from "@/lib/security/csrf";
import { maskEmail, stripControlChars } from "@/lib/security/pii";
import { validateWithSchema } from "@/lib/security/validation";

import { contactFormSchema, type ContactFormValues } from "./validation";

const contactLogger = createLogger("contact.actions");
const CONTACT_RATE_LIMIT_MESSAGE = "Too many messages were sent from this network. Please wait a few minutes and try again.";

export type ContactFormResult =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Submit contact form and send notifications
 *
 * Flow:
 * 1. Validate input
 * 2. Save to database
 * 3. Send email + Telegram notifications to admin
 * 4. Return success/error
 *
 * Notifications are non-blocking - submission succeeds even if delivery fails
 */
export async function submitContactForm(
  values: ContactFormValues,
): Promise<ContactFormResult> {
  const db = getPrismaClient();
  const notificationService = getNotificationService();

  try {
    await assertTrustedOrigin({ action: "contact:submit" });

    const validated = validateWithSchema(contactFormSchema, values);
    if (!validated.success) {
      return {
        success: false,
        error: validated.errors[0] ?? "Please check your message and try again.",
      };
    }

    const headerList = await headers();
    const ip = getClientIp(headerList);
    const rateLimitResult = await checkRateLimit({
      identifier: `${ip}:${validated.data.email.toLowerCase()}`,
      action: "contact:submit",
      limit: 5,
      windowMs: 10 * 60_000,
    });

    if (!rateLimitResult.success) {
      return {
        success: false,
        error: CONTACT_RATE_LIMIT_MESSAGE,
      };
    }

    contactLogger.info("contact form submission started", {
      email: maskEmail(validated.data.email),
      subject: validated.data.subject,
    });

    // Save to database
    const submission = await db.contactSubmission.create({
      data: {
        fullName: validated.data.fullName,
        email: validated.data.email,
        subject: validated.data.subject,
        message: validated.data.message,
      },
    });

    contactLogger.info("contact submission saved", {
      id: submission.id,
      email: maskEmail(validated.data.email),
    });

    // Send notifications (non-blocking)
    try {
      const notificationResult = await notificationService.dispatch({
        type: notificationEventTypes.contactFormSubmitted,
        payload: {
          fullName: validated.data.fullName,
          email: validated.data.email,
          subject: validated.data.subject,
          messagePreview: validated.data.message.substring(0, 150),
        },
      });

      if (notificationResult.failures.length > 0) {
        contactLogger.warn("some contact notifications failed", {
          submissionId: submission.id,
          failures: notificationResult.failures,
        });
      }
    } catch (notificationError) {
      // Log but don't fail the submission
      contactLogger.error("contact notification dispatch failed", {
        submissionId: submission.id,
        error: notificationError,
      });
    }

    return {
      success: true,
      message: "Thank you for contacting us. We'll respond within 1-2 business days.",
    };
  } catch (error) {
    contactLogger.error("contact form submission failed", {
      error,
      email: typeof values.email === "string" ? maskEmail(stripControlChars(values.email)) : undefined,
    });

    if (error instanceof AppError) {
      return {
        success: false,
        error: error.userMessage ?? "An unknown error occurred",
      };
    }

    return {
      success: false,
      error: "Failed to submit your message. Please try again.",
    };
  }
}