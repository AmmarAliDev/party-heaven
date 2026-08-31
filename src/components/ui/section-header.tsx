import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Badge } from "./badge";

type SectionHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
  titleAs?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  titleId?: string;
};

export function SectionHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  titleAs = "h2",
  titleId,
}: SectionHeaderProps) {
  const TitleTag = titleAs;

  return (
    <div className={cn("flex flex-col gap-4 ", className)}>
      <div className="space-y-3">
        {eyebrow ? <Badge variant="secondary">{eyebrow}</Badge> : null}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TitleTag
              id={titleId}
              className="text-2xl text-foreground font-semibold tracking-tight text-balance sm:text-3xl"
            >
              {title}
            </TitleTag>
            {actions ? <div className="flex shrink-0 flex-wrap gap-2 justify-end">{actions}</div> : null}
          </div>
          {description ? <p className="text-primary-strong text-sm sm:text-base">{description}</p> : null}
        </div>
      </div>

    </div>
  );
}
