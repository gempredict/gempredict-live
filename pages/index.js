// pages/index.js
// GemPredict — Homepage with SEO metadata
import Head from "next/head";
import App from "../src/App";

export default function Home() {
  return (
    <>
      <Head>
        <title>GemPredict — AI Card Grading ROI Tool</title>
        <meta name="description" content="GemPredict helps collectors decide whether a card is worth grading by estimating raw value, PSA 9, PSA 10, and grading upside. Free AI-powered tool for Pokemon, sports cards, MTG, Yu-Gi-Oh!, and more." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="GemPredict — AI Card Grading ROI Tool" />
        <meta property="og:description" content="Should you grade this card? GemPredict estimates raw value, PSA 9, PSA 10, and grading upside instantly. Free for all collectors." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://gempredict.com" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="GemPredict — AI Card Grading ROI Tool" />
        <meta name="twitter:description" content="Should you grade this card? Get instant raw, PSA 9, and PSA 10 value estimates plus a clear Grade It / Skip It verdict." />
        <link rel="canonical" href="https://gempredict.com" />
      </Head>
      <App />
    </>
  );
}
