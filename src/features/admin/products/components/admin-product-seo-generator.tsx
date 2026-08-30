"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { ProductSeoContentResult } from "../seo-content-generator";
import { generateProductSeoContent } from "../seo-content-generator";
import type { AdminProductCreateInput } from "../validation";

type AdminProductSeoGeneratorProps = {
  form: UseFormReturn<AdminProductCreateInput>;
  categoryName?: string | undefined;
  disabled?: boolean | undefined;
};

export function AdminProductSeoGenerator({ form, categoryName, disabled = false }: AdminProductSeoGeneratorProps) {
  const watchedValues = useWatch({ control: form.control });
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ProductSeoContentResult | null>(null);

  const schemaNotes = useMemo(() => {
    if (!result) {
      return "";
    }

    const specs = result.structuredSpecificationSuggestions
      .map((item) => `${item.key}: ${item.suggestedValue}`)
      .join("; ");
    const faqs = result.faqIdeas.map((item) => item.question).join(" | ");

    return `Suggested spec structure: ${specs}\nFAQ ideas: ${faqs}`.slice(0, 1800);
  }, [result]);

  const handleGenerate = async () => {
    setErrorMessage(null);
    setIsGenerating(true);

    try {
      const title = `${watchedValues.title ?? ""}`.trim();
      if (!title) {
        throw new Error("Please add a product title first, then generate SEO content.");
      }

      const generated = generateProductSeoContent({
        title,
        categoryName: categoryName ?? null,
        shortDescription: watchedValues.shortDescription,
        description: watchedValues.description,
        specifications: (watchedValues.specifications ?? []).map((specification) => ({
          key: specification.key ?? "",
          value: specification.value ?? "",
        })),
      });

      setResult(generated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not generate SEO content right now. Please try again.";
      setErrorMessage(message);
      setResult(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const applySeoFields = () => {
    if (!result || disabled) {
      return;
    }

    form.setValue("slug", result.suggestedSlug, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    form.setValue("seoTitle", result.seoTitle, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    form.setValue("seoDescription", result.metaDescription, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    form.setValue("seoOgTitle", result.seoTitle, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    form.setValue("seoOgDescription", result.metaDescription, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    form.setValue("seoSchemaNotes", schemaNotes, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  };

  const applyShortDescription = () => {
    if (!result || disabled) {
      return;
    }

    form.setValue("shortDescription", result.shortDescription, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Product SEO content helper</CardTitle>
            <CardDescription>Generate simple, conversion-friendly copy for Pakistan shoppers from your product details.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={disabled || isGenerating}
            className="gap-2"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage && <p className="text-sm font-medium text-destructive">{errorMessage}</p>}

        {!result && !errorMessage && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Enter a product title and click &ldquo;Generate&rdquo; to see AI suggestions.
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">SEO & Meta Suggestions</h4>
                <Button type="button" variant="ghost" size="sm" onClick={applySeoFields} disabled={disabled}>
                  Apply All SEO Fields
                </Button>
              </div>

              <div className="rounded-md border bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="secondary">Preview</Badge>
                  <span className="text-xs text-muted-foreground truncate max-w-50">
                    {result.suggestedSlug}
                  </span>
                </div>
                <h5 className="line-clamp-1 font-semibold text-blue-600">
                  {result.seoTitle}
                </h5>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {result.metaDescription}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">Title Improvements</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.titleImprovementSuggestions.map((suggestion) => (
                    <Badge
                      key={suggestion}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
                      onClick={() =>
                        form.setValue("title", suggestion, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Content Improvements</h4>
                <Button type="button" variant="ghost" size="sm" onClick={applyShortDescription} disabled={disabled}>
                  Apply Short Description
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Suggested Short Description</p>
                  <p className="text-sm italic text-muted-foreground">{result.shortDescription}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Product Highlights</p>
                  <ul className="list-inside list-disc text-sm space-y-0.5 text-muted-foreground">
                    {result.productHighlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">FAQ Ideas</p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {result.faqIdeas.map((faq) => (
                      <li key={faq.question} className="rounded border bg-muted/20 p-2">
                        <p className="font-medium text-foreground">{faq.question}</p>
                        <p>{faq.shortAnswerDirection}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Structured Specification Suggestions</p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {result.structuredSpecificationSuggestions.map((spec) => (
                      <li key={`${spec.key}:${spec.suggestedValue}`} className="rounded border bg-muted/20 p-2">
                        <p className="font-medium text-foreground">{spec.key}</p>
                        <p>{spec.suggestedValue}</p>
                        <p className="text-xs">{spec.reason}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-sm font-medium">Internal Linking Ideas</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {result.internalLinkingSuggestions.map((link) => (
                  <div key={`${link.href}:${link.anchorText}`} className="rounded border p-2 text-xs">
                    <p className="font-medium">{link.anchorText}</p>
                    <p className="text-muted-foreground truncate">{link.href}</p>
                    <p className="text-muted-foreground">{link.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

