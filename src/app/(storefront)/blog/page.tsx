import { Newspaper } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { PageErrorFallback } from "@/components/ui/page-error-fallback";
import { SectionHeader } from "@/components/ui/section-header";
import { buildMetadata } from "@/config/metadata";
import { BlogPostCard, buildBlogListingJsonLd, getBlogPosts } from "@/features/blog";

export const revalidate = 900;

export const metadata = buildMetadata({
  title: "Blog",
  path: "/blog",
  description:
    "Read practical shopping, budget, and household planning guides from the Party Heaven team.",
});

export default async function BlogListingPage() {
  let posts = [] as Awaited<ReturnType<typeof getBlogPosts>>;
  let jsonLd = buildBlogListingJsonLd(posts);
  let loadError: unknown = null;

  try {
    posts = await getBlogPosts({ locale: "en" });
    jsonLd = buildBlogListingJsonLd(posts);
  } catch (error) {
    loadError = error;
  }

  if (loadError) {
    return (
      <PageShell>
        <PageErrorFallback
          error={loadError}
          fullPage={false}
          title="We could not load the blog"
          description="Please try again in a moment. If the issue continues, contact support."
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="gap-8">
      <SectionHeader
        eyebrow="Blog"
        title="Guides and updates"
        titleAs="h1"
        titleId="blog-listing-heading"
        description="Explore practical articles focused on smart shopping, planning, and better household routines."
      />

      {posts.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="No blog posts are published yet"
          description="Articles will appear here as soon as the publishing workflow is completed."
          eyebrow="Empty state"
        />
      ) : (
        <ul aria-labelledby="blog-listing-heading" className="grid gap-6 md:grid-cols-2">
          {posts.map((post) => (
            <li key={post.id} className="list-none">
              <BlogPostCard post={post} />
            </li>
          ))}
        </ul>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c").replace(/>/g, "\\u003e"),
        }}
      />
    </PageShell>
  );
}
