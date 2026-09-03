import { formatPrice } from "@/lib/currency";
import { cn } from "@/lib/utils";

import { Badge } from "./badge";

type PriceDisplayProps = {
  amount: number;
  compareAt?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl sm:text-4xl",
} as const;

export function PriceDisplay({
  amount,
  compareAt,
  className,
  size = "md",
}: PriceDisplayProps) {
  const hasDiscount = typeof compareAt === "number" && compareAt > amount;
  const savingsPercent = hasDiscount ? Math.ceil(((compareAt - amount) / compareAt) * 100) : 0;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className={cn("font-semibold tracking-tight", sizeMap[size])}>{formatPrice(amount)}</span>
      {hasDiscount ? (
        <>
          <span className="text-muted-foreground text-xxs line-through">{formatPrice(compareAt)}</span>
          {savingsPercent > 0 ? <Badge variant="success" className="p-1 text-xxs">{savingsPercent}% Off</Badge> : null}
        </>
      ) : null}
    </div>
  );
}
