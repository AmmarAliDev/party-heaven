import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { PageErrorFallback } from "@/components/ui/page-error-fallback";
import { SectionHeader } from "@/components/ui/section-header";
import { buildMetadata } from "@/config/metadata";
import {
  BlogPostCard,
  BlogPostContent,
  buildBlogPostBreadcrumbJsonLd,
  buildBlogPostJsonLd,
  formatBlogPublishedDate,
  getBlogPostBySlug,
  getBlogPostSlugs,
  getRelatedBlogPosts,
  toBlogMetadataInput,
} from "@/features/blog";
import {
  toBlogStaticParams,
} from "@/features/rendering/seo-content-rendering";

export const revalidate = 900;

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await getBlogPostSlugs("en");
  return toBlogStaticParams(slugs);
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const post = await getBlogPostBySlug(slug, { locale: "en" });

    if (!post) {
      return buildMetadata({
        title: "Blog post",
        path: `/blog/${slug}`,
        description: "Requested blog post.",
      });
    }

    const metadataInput = toBlogMetadataInput(post);

    return buildMetadata({
      title: metadataInput.title,
      description: metadataInput.description,
      path: metadataInput.path,
      ...(metadataInput.canonicalUrl ? { canonicalUrl: metadataInput.canonicalUrl } : {}),
      ...(metadataInput.openGraphTitle ? { openGraphTitle: metadataInput.openGraphTitle } : {}),
      ...(metadataInput.openGraphDescription
        ? { openGraphDescription: metadataInput.openGraphDescription }
        : {}),
      ...(metadataInput.openGraphImage ? { openGraphImage: metadataInput.openGraphImage } : {}),
      ...(metadataInput.keywords ? { keywords: metadataInput.keywords } : {}),
      ...(typeof metadataInput.noIndex === "boolean" ? { noIndex: metadataInput.noIndex } : {}),
    });
  } catch {
    return buildMetadata({
      title: "Blog post",
      path: `/blog/${slug}`,
      description: "Requested blog post.",
    });
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  let post: Awaited<ReturnType<typeof getBlogPostBySlug>> = null;
  let loadError: unknown = null;

  try {
    post = await getBlogPostBySlug(slug, { locale: "en" });
  } catch (error) {
    loadError = error;
  }

  if (loadError) {
    return (
      <PageShell>
        <PageErrorFallback
          error={loadError}
          fullPage={false}
          title="We could not load this article"
          description="Please try again in a moment or return to the blog listing."
        />
      </PageShell>
    );
  }

  if (!post) {
    notFound();
  }

  const relatedPosts = await getRelatedBlogPosts(post, 2);
  const articleJsonLd = buildBlogPostJsonLd(post);
  const breadcrumbJsonLd = buildBlogPostBreadcrumbJsonLd(post);

  function sanitizeJsonLd(json: string): string {
    return json.replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  }

  return (
    <PageShell className="gap-10">
      <article className="space-y-6">
        <SectionHeader
          eyebrow="Blog"
          title={post.title}
          titleAs="h1"
          description={post.excerpt}
          actions={
            <span className="text-muted-foreground text-sm">{formatBlogPublishedDate(post.publishedAt)}</span>
          }
        />

        <Image
          src={post.coverImage.src}
          alt={post.coverImage.alt}
          width={post.coverImage.width}
          height={post.coverImage.height}
          className="bg-muted rounded-(--radius-card) border object-cover"
          sizes="(max-width: 1024px) 100vw, 1024px"
          loading="eager"
          fetchPriority="high"
        />

        <BlogPostContent blocks={post.content} />
      </article>

      <section className="space-y-4" aria-labelledby="related-posts-heading">
        <h2 id="related-posts-heading" className="text-2xl font-semibold tracking-tight">
          Related posts
        </h2>
        {relatedPosts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Related articles will appear here as more posts are published.
          </p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {relatedPosts.map((relatedPost) => (
              <li key={relatedPost.id} className="list-none">
                <BlogPostCard post={relatedPost} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: sanitizeJsonLd(JSON.stringify(articleJsonLd)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: sanitizeJsonLd(JSON.stringify(breadcrumbJsonLd)),
        }}
      />
    </PageShell>
  );
}
