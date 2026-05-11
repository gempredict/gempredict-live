// pages/privacy.js
// GemPredict — Privacy Policy page

const C = {
  cream: "#f5f3ee", white: "#ffffff", ink: "#0e0f0c",
  inkMid: "#3d3d39", inkSoft: "#7a7a74", border: "#e2dfd8",
  gold: "#c9a84c",
};

const SECTIONS = [
  {
    title: "Who We Are",
    body: "GemPredict (gempredict.com) is an AI-powered grading decision tool for trading card collectors. We are not affiliated with PSA, Beckett, CGC, or any other grading company. GemPredict is an independent product.",
  },
  {
    title: "What Information We Collect",
    body: "GemPredict collects minimal information. When you use the card analysis tool, your search inputs (card name, type, and set) are sent to our AI service to generate a response. We do not store individual search queries tied to your identity. If you voluntarily submit your email address to join our photo grading waitlist, that email is stored securely and used only to notify you of product updates. We may also collect basic, anonymised usage analytics (such as page views and feature interactions) to help us improve the product. We do not sell your data to third parties.",
  },
  {
    title: "How We Use Your Information",
    body: "Email addresses collected via our waitlist are used solely to send product updates and launch notifications. You can request removal from our list at any time by contacting us. Usage analytics are used in aggregate to understand how the product is being used and to guide improvements. We do not use your information for advertising or share it with advertisers.",
  },
  {
    title: "AI-Generated Estimates",
    body: "GemPredict uses an AI language model to generate card valuation estimates. These estimates are based on the model's training data and general market knowledge — they are not sourced from live auction results, real-time pricing databases, or verified market feeds. Valuations may be inaccurate, outdated, or not applicable to your specific card's condition, variant, or regional market. Do not rely on GemPredict outputs as financial advice or as a guarantee of any card's actual market value.",
  },
  {
    title: "Cookies and Tracking",
    body: "GemPredict may use essential cookies required for the application to function. We may also use anonymised analytics tools. We do not use tracking cookies for advertising purposes.",
  },
  {
    title: "Third-Party Services",
    body: "GemPredict uses the Anthropic Claude API to power AI-generated predictions. Card search inputs are transmitted to Anthropic's API infrastructure for processing. Please refer to Anthropic's privacy policy for details on how they handle data sent to their API. GemPredict is hosted on Vercel. Basic request metadata may be logged by Vercel's infrastructure. Please refer to Vercel's privacy policy for details.",
  },
  {
    title: "Data Retention",
    body: "Email addresses on our waitlist are retained until you request removal or we discontinue the waitlist. We do not retain individual card search queries.",
  },
  {
    title: "Your Rights",
    body: "You may request deletion of any personal data we hold about you (such as your email address) by contacting us. We will respond to data deletion requests within a reasonable timeframe.",
  },
  {
    title: "Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. When we do, we will update the date at the bottom of this page. Continued use of GemPredict after changes constitutes acceptance of the updated policy.",
  },
  {
    title: "Contact",
    body: "For any privacy-related questions or requests, please contact us via the contact link in the footer.",
  },
];

export default function Privacy() {
  return (
    <div style={{ fontFamily: "'Outfit', system-ui, sans-serif", background: C.cream, minHeight: "100vh", color: C.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <style>{`* { box-sizing: border-box; } body { margin: 0; }`}</style>

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 200,
        background: "rgba(245,243,238,0.95)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid " + C.border,
        height: 62, display: "flex", alignItems: "center",
        padding: "0 1.5rem",
      }}>
        <a href="/" style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.35rem", fontWeight: 900, letterSpacing: "-0.01em", textDecoration: "none", color: C.ink }}>
          Gem<span style={{ color: C.gold }}>Predict</span>
        </a>
        <a href="/" style={{ marginLeft: "auto", fontSize: "0.875rem", fontWeight: 500, color: C.inkSoft, textDecoration: "none" }}>
          Back to Home
        </a>
      </nav>

      {/* CONTENT */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "5rem 1.5rem 6rem" }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold, marginBottom: "0.6rem" }}>
          Legal
        </p>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "clamp(2rem, 4vw, 3rem)",
          fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.1,
          marginBottom: "0.75rem",
        }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: "0.875rem", color: C.inkSoft, marginBottom: "3.5rem" }}>
          Last updated: January 2026
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          {SECTIONS.map(function(s) {
            return (
              <div key={s.title}>
                <h2 style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "1.25rem", fontWeight: 700,
                  marginBottom: "0.75rem", color: C.ink,
                }}>
                  {s.title}
                </h2>
                <p style={{ fontSize: "0.95rem", color: C.inkMid, lineHeight: 1.85 }}>
                  {s.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ background: C.ink, borderTop: "1px solid rgba(255,255,255,0.07)", padding: "2rem 1.5rem" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 900, color: "#fff" }}>
            Gem<span style={{ color: C.gold }}>Predict</span>
          </span>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            {[["Privacy Policy", "/privacy"], ["Terms of Use", "/terms"], ["Contact", "#"]].map(function(l) {
              return (
                <a key={l[0]} href={l[1]} style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>
                  {l[0]}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
