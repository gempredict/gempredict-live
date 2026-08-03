/// GemPredict — Homepage with SEO metadata
import Head from "next/head";
import App from "../src/App";

export default function Home() {
  return (
    <>
      <Head>
        <title>GemPredict — Smarter Decisions for Trading Card Collectors</title>

        <meta
          name="description"
          content="GemPredict helps collectors know what to do with their cards—and why. Evaluate card identity, visible condition, market evidence, grading outcomes, and total costs to decide whether to grade, sell, hold, or inspect further."
        />

        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <meta
          property="og:title"
          content="GemPredict — Know What to Do With Your Cards"
        />

        <metanpm run dev
        
          property="og:description"
          content="GemPredict helps collectors make smarter decisions by bringing together card identity, visible condition, market evidence, grading outcomes, and total costs."
        />

        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://gempredict.com" />

        <meta name="twitter:card" content="summary_large_image" />

        <meta
          name="twitter:title"
          content="GemPredict — Know What to Do With Your Cards"
        />

        <meta
          name="twitter:description"
          content="See whether to grade, sell, hold, or take a closer look—and understand why."
        />

        <link rel="canonical" href="https://gempredict.com" />
      </Head>

      <App />
    </>
  );
}