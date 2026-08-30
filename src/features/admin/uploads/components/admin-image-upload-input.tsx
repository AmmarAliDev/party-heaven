"use client";

import { useRef, useState } from "react";
import { ExternalLink, ImagePlus, Loader2, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { uploadAdminImage } from "../client";
import {
  ADMIN_IMAGE_UPLOAD_ACCEPT,
  ADMIN_IMAGE_UPLOAD_MAX_BYTES,
  type AdminImageUploadPurpose,
  formatImageUploadSize,
} from "../constants";

type AdminImageUploadInputProps = {
  inputId: string;
  value: string;
  purpose: AdminImageUploadPurpose;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  describedBy?: string | undefined;
  invalid?: boolean | undefined;
  onChange: (value: string) => void;
  onBlur: () => void;
};

export function AdminImageUploadInput({
  inputId,
  value,
  purpose,
  placeholder,
  disabled = false,
  describedBy,
  invalid = false,
  onChange,
  onBlur,
}: AdminImageUploadInputProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const trimmedValue = value.trim();
  const hasValue = trimmedValue.length > 0;

  async function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (!selectedFile) {
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const upload = await uploadAdminImage({
        file: selectedFile,
        purpose,
      });

      onChange(upload.url);
      onBlur();
      setUploadMessage("Image uploaded. The field now contains the final URL.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not upload that image right now.";
      setUploadMessage(message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-muted/20 p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background text-xs text-muted-foreground">
            {hasValue ? (
              // Plain img keeps admin previews resilient for arbitrary uploaded URLs.
              // eslint-disable-next-line @next/next/no-img-element -- preview of arbitrary blob URLs; next/image remote config would reject them.
              <img src={trimmedValue} alt="Selected upload preview" className="h-full w-full object-cover" />
            ) : (
              <span className="px-2 text-center">No image yet</span>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={disabled || isUploading}
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                {isUploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                {isUploading ? "Uploading..." : hasValue ? "Replace image" : "Upload image"}
              </Button>

              {hasValue ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled || isUploading}
                  onClick={() => {
                    onChange("");
                    onBlur();
                    setUploadMessage(null);
                  }}
                >
                  <Trash2 className="size-4" />
                  Clear
                </Button>
              ) : null}

              {hasValue ? (
                <a
                  href={trimmedValue}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "ghost" })}
                >
                  <ExternalLink className="size-4" />
                  Open image
                </a>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              Upload a JPG, PNG, WEBP, AVIF, or GIF image up to {formatImageUploadSize(ADMIN_IMAGE_UPLOAD_MAX_BYTES)}.
              You can still paste an existing URL below when needed.
            </p>

            {uploadMessage ? (
              <p
                className={cn(
                  "text-sm",
                  uploadMessage.startsWith("Image uploaded") ? "text-emerald-700" : "text-destructive",
                )}
              >
                {uploadMessage}
              </p>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              accept={ADMIN_IMAGE_UPLOAD_ACCEPT}
              className="hidden"
              disabled={disabled || isUploading}
              onChange={handleFileSelection}
            />
          </div>
        </div>
      </div>

      <Input
        id={inputId}
        name={inputId}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onBlur={onBlur}
        disabled={disabled || isUploading}
        placeholder={placeholder}
        aria-describedby={describedBy}
        aria-invalid={invalid}
      />
    </div>
  );
}