import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/20 bg-primary/10 text-primary-strong",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border/80 bg-background text-foreground",
        success: "border-transparent bg-success/15 text-success-strong",
        warning: "border-transparent bg-warning/15 text-warning",
        danger: "border-transparent bg-destructive/15 text-destructive",
        info: "border-transparent bg-info/15 text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
