import type { JSX } from "react";

import type { BlogContentBlock } from "../types";

type BlogPostContentProps = {
  blocks: BlogContentBlock[];
};

export function BlogPostContent({ blocks }: BlogPostContentProps) {
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p key={`${block.type}-${index}`} className="text-muted-foreground text-sm leading-7 sm:text-base">
              {block.text}
            </p>
          );
        }

        if (block.type === "heading") {
          const HeadingTag = `h${block.level}` as keyof JSX.IntrinsicElements;
          return (
            <HeadingTag key={`${block.type}-${index}`} className="text-xl font-semibold tracking-tight sm:text-2xl">
              {block.text}
            </HeadingTag>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={`${block.type}-${index}`} className="list-disc space-y-2 pl-6 text-sm sm:text-base">
              {block.items.map((item, i) => (
                <li key={`${item}-${i}`} className="text-muted-foreground leading-7">
                  {item}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <blockquote
            key={`${block.type}-${index}`}
            className="border-primary/40 bg-muted/50 rounded-(--radius) border-l-4 px-4 py-3 text-sm italic sm:text-base"
          >
            {block.text}
          </blockquote>
        );
      })}
    </div>
  );
}
