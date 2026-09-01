'use client';

import { Suspense,useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { trackEvent } from '../lib';

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasMounted = useRef(false);

  // Route change tracking (Page Views)
  // Skip initial mount to avoid duplicating provider auto-pageviews
  useEffect(() => {
    if (pathname) {
      if (!hasMounted.current) {
        hasMounted.current = true;
        return;
      }
      const qs = searchParams?.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      trackEvent({ type: 'PAGE_VIEW', payload: { url } });
    }
  }, [pathname, searchParams]);

  return null;
}

/**
 * Analytics provider. GTM (loaded in the root layout via
 * `@next/third-parties` `GoogleTagManager`) is the ONLY tracking pipeline:
 * GA4 and Meta Pixel are configured inside the GTM container, so no GA4 or
 * Meta Pixel scripts are loaded directly here. This component only tracks
 * SPA route changes as `page_view` events on the GTM dataLayer.
 */
export function AnalyticsProvider() {
  return (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  );
}
