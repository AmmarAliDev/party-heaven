import Image from "next/image";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";

import { formatBlogPublishedDate } from "../service";
import type { BlogListingItem } from "../types";

type BlogPostCardProps = {
  post: BlogListingItem;
};

export function BlogPostCard({ post }: BlogPostCardProps) {
  const blogPostHref = routes.storefront.blogPost(post.slug);

  return (
    <article>
      <Card className="overflow-hidden">
        <Link href={blogPostHref} className="group block">
          <Image
            src={post.coverImage.src}
            alt={post.coverImage.alt}
            width={post.coverImage.width}
            height={post.coverImage.height}
            sizes="(max-width: 767px) 100vw, 50vw"
            className="bg-muted h-48 w-full object-cover group-hover:brightness-95"
          />

          <CardHeader>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Published{" "}
              <time dateTime={post.publishedAt}>{formatBlogPublishedDate(post.publishedAt)}</time>
            </p>
            <CardTitle className="text-xl transition-colors group-hover:text-primary">{post.title}</CardTitle>
            <CardDescription>{post.excerpt}</CardDescription>
          </CardHeader>

          <CardContent>
            <span className="text-primary text-sm font-semibold group-hover:underline">
              Read article
            </span>
          </CardContent>
        </Link>
      </Card>
    </article>
  );
}
