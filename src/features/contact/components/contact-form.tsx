"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { type DynamicFormFieldConfig,SchemaForm } from "@/components/forms";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toUserMessage } from "@/lib/errors/error-messages";

import { submitContactForm } from "../actions";
import { contactFormSchema, type ContactFormValues } from "../validation";

const fields: DynamicFormFieldConfig<ContactFormValues>[] = [
  {
    name: "fullName",
    type: "text",
    label: "Full name",
    placeholder: "John Doe",
    required: true,
  },
  {
    name: "email",
    type: "email",
    label: "Email address",
    placeholder: "you@example.com",
    required: true,
  },
  {
    name: "subject",
    type: "text",
    label: "Subject",
    placeholder: "How can we help?",
    required: true,
  },
  {
    name: "message",
    type: "textarea",
    label: "Message",
    placeholder: "Tell us more about your inquiry...",
    rows: 6,
    required: true,
  },
];

type FormState = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [formState, setFormState] = useState<FormState>("idle");
  const [resultMessage, setResultMessage] = useState<string>("");

  const handleSubmit = async (values: ContactFormValues) => {
    setFormState("submitting");
    setResultMessage("");

    try {
      const result = await submitContactForm(values);

      if (result.success) {
        setFormState("success");
        setResultMessage(result.message);
      } else {
        setFormState("error");
        setResultMessage(result.error);
      }
    } catch (error) {
      setFormState("error");
      setResultMessage(toUserMessage(error));
    }
  };

  if (formState === "success") {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert className="border-green-200 bg-green-50 text-green-900">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertTitle className="font-semibold">Message sent successfully</AlertTitle>
          <AlertDescription>{resultMessage}</AlertDescription>
        </Alert>

        <button
          onClick={() => {
            setFormState("idle");
            setResultMessage("");
          }}
          className="mt-6 text-sm text-primary hover:underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {formState === "error" && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Submission failed</AlertTitle>
          <AlertDescription>{resultMessage}</AlertDescription>
        </Alert>
      )}

      <SchemaForm
        schema={contactFormSchema}
        fields={fields}
        onSubmit={handleSubmit}
        formOptions={{
          defaultValues: {
            fullName: "",
            email: "",
            subject: "",
            message: "",
          },
        }}
        actions={
          <div className="flex justify-end">
            <Button type="submit" disabled={formState === "submitting"}>
              {formState === "submitting" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send message"
              )}
            </Button>
          </div>
        }
      />
    </div>
  );
}
