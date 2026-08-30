export interface NavItem {
  title: string;
  href: string;
  description?: string;
}

export interface FeatureFlags {
  readonly adminPreview: boolean;
  readonly authPreview: boolean;
  readonly checkout: boolean;
  readonly payments: boolean;
}

/** Generic type for Next.js page `searchParams` (async in Next.js 15+). */
export type SearchParams = Record<string, string | string[] | undefined>;
