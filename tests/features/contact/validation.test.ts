import { describe, expect,it } from "vitest";

import { contactFormSchema } from "@/features/contact/validation";

describe("contactFormSchema", () => {
  it("accepts valid contact form data", () => {
    const validData = {
      fullName: "John Doe",
      email: "john@example.com",
      subject: "Product inquiry",
      message: "I have a question about your products.",
    };

    const result = contactFormSchema.safeParse(validData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it("trims whitespace from all fields", () => {
    const dataWithWhitespace = {
      fullName: "  John Doe  ",
      email: "  john@example.com  ",
      subject: "  Product inquiry  ",
      message: "  I have a question about your products.  ",
    };

    const result = contactFormSchema.safeParse(dataWithWhitespace);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("John Doe");
      expect(result.data.email).toBe("john@example.com");
      expect(result.data.subject).toBe("Product inquiry");
      expect(result.data.message).toBe("I have a question about your products.");
    }
  });

  it("rejects fullName less than 2 characters", () => {
    const invalidData = {
      fullName: "J",
      email: "john@example.com",
      subject: "Product inquiry",
      message: "I have a question about your products.",
    };

    const result = contactFormSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["fullName"]);
      expect(result.error.issues[0]?.message).toContain("at least 2 characters");
    }
  });

  it("rejects fullName over 100 characters", () => {
    const invalidData = {
      fullName: "a".repeat(101),
      email: "john@example.com",
      subject: "Product inquiry",
      message: "I have a question about your products.",
    };

    const result = contactFormSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["fullName"]);
      expect(result.error.issues[0]?.message).toContain("cannot exceed 100 characters");
    }
  });

  it("rejects invalid email format", () => {
    const invalidData = {
      fullName: "John Doe",
      email: "not-an-email",
      subject: "Product inquiry",
      message: "I have a question about your products.",
    };

    const result = contactFormSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"]);
      expect(result.error.issues[0]?.message).toContain("valid email");
    }
  });

  it("rejects email over 254 characters", () => {
    const longEmail = `${"a".repeat(243)}@example.com`; // 243 + 12 = 255 chars (over limit)

    const invalidData = {
      fullName: "John Doe",
      email: longEmail,
      subject: "Product inquiry",
      message: "I have a question about your products.",
    };

    const result = contactFormSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"]);
      expect(result.error.issues[0]?.message).toContain("cannot exceed 254 characters");
    }
  });

  it("rejects subject less than 3 characters", () => {
    const invalidData = {
      fullName: "John Doe",
      email: "john@example.com",
      subject: "Hi",
      message: "I have a question about your products.",
    };

    const result = contactFormSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["subject"]);
      expect(result.error.issues[0]?.message).toContain("at least 3 characters");
    }
  });

  it("rejects subject over 200 characters", () => {
    const invalidData = {
      fullName: "John Doe",
      email: "john@example.com",
      subject: "a".repeat(201),
      message: "I have a question about your products.",
    };

    const result = contactFormSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["subject"]);
      expect(result.error.issues[0]?.message).toContain("cannot exceed 200 characters");
    }
  });

  it("rejects message less than 10 characters", () => {
    const invalidData = {
      fullName: "John Doe",
      email: "john@example.com",
      subject: "Product inquiry",
      message: "Short",
    };

    const result = contactFormSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["message"]);
      expect(result.error.issues[0]?.message).toContain("at least 10 characters");
    }
  });

  it("rejects message over 2000 characters", () => {
    const invalidData = {
      fullName: "John Doe",
      email: "john@example.com",
      subject: "Product inquiry",
      message: "a".repeat(2001),
    };

    const result = contactFormSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["message"]);
      expect(result.error.issues[0]?.message).toContain("cannot exceed 2000 characters");
    }
  });

  it("rejects missing required fields", () => {
    const invalidData = {};

    const result = contactFormSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(4); // All 4 fields are required
    }
  });
});
