import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageContainerProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "main" | "article";
  children: ReactNode;
};

export function PageContainer({
  as: Component = "div",
  children,
  className,
  ...props
}: PageContainerProps) {
  return (
    <Component
      className={cn("mx-2 lg:mx-auto w-full max-w-11/12 px-2 md:px-4 lg:px-6 xl:px-8", className)}
      {...props}
    >
      {children}
    </Component>
  );
}
