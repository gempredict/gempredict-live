// pages/_app.js
// GemPredict — Next.js app wrapper
//
// Vercel Analytics is mounted here so it runs on every page automatically.
// It tracks page views with zero configuration once deployed to Vercel.
//
// Custom event tracking (prediction_submitted, waitlist_signup, photo_tab_clicked)
// is handled in src/App.jsx via the `track` function from @vercel/analytics/react.
//
// TO ADD MORE ANALYTICS LATER:
// - Replace or augment <Analytics /> with a third-party provider (PostHog, Mixpanel, etc.)
//   by adding their <Script> or provider component here alongside <Analytics />.
// - For server-side event tracking, use Vercel edge middleware or API route hooks.

import { Analytics } from "@vercel/analytics/react";

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      {/*
        Analytics renders a small script Vercel uses for page view tracking.
        It is a safe no-op in local development — no data is sent locally.
        Docs: https://vercel.com/docs/analytics
      */}
      <Analytics />
    </>
  );
}
