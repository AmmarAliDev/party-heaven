'use client';

import { Suspense,useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';

import { env } from '@/config/env';

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

export function AnalyticsProvider() {
  return (
    <>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>

      {/* Google Analytics 4 */}
      {env.gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${env.gaId}`}
            strategy="lazyOnload"
          />
          <Script id="google-analytics" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){window.dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', '${env.gaId}');
            `}
          </Script>
        </>
      )}

      {/* Meta Pixel */}
      {env.metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${env.metaPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
