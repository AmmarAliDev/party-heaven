export const blogPostStatusValues = ["draft", "published", "archived"] as const;

export type BlogPostStatus = (typeof blogPostStatusValues)[number];

export const blogLocaleValues = ["en", "ur"] as const;

export type BlogLocale = (typeof blogLocaleValues)[number];

export type BlogCoverImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type BlogSeoFields = {
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  keywords?: string;
  noIndex?: boolean;
  structuredDataNotes?: string;
};

export type BlogContentParagraphBlock = {
  type: "paragraph";
  text: string;
};

export type BlogContentHeadingBlock = {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
};

export type BlogContentListBlock = {
  type: "list";
  items: string[];
};

export type BlogContentQuoteBlock = {
  type: "quote";
  text: string;
};

export type BlogContentBlock =
  | BlogContentParagraphBlock
  | BlogContentHeadingBlock
  | BlogContentListBlock
  | BlogContentQuoteBlock;

export type BlogPost = {
  id: string;
  locale: BlogLocale;
  title: string;
  slug: string;
  excerpt: string;
  content: BlogContentBlock[];
  coverImage: BlogCoverImage;
  status: BlogPostStatus;
  publishedAt?: string;
  seo: BlogSeoFields;
};

export type BlogListingItem = Pick<
  BlogPost,
  "id" | "locale" | "title" | "slug" | "excerpt" | "coverImage" | "status" | "publishedAt"
>;

export type BlogMetadataInput = {
  title: string;
  description: string;
  path: string;
  canonicalUrl?: string;
  openGraphTitle?: string;
  openGraphDescription?: string;
  openGraphImage?: string;
  keywords?: string;
  noIndex?: boolean;
};
