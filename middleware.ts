import { NextResponse, type NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hermes Letters · Concluded</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    :root {
      --bg: #0c0a09;
      --card-bg: #1c1917;
      --border: #292524;
      --text: #f5f5f4;
      --muted: #a8a29e;
      --subtle: #78716c;
      --accent: #d97706;
      --accent-glow: rgba(217, 119, 6, 0.12);
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      background-image: radial-gradient(circle at 50% 20%, rgba(217, 119, 6, 0.04), transparent 60%);
    }
    .container {
      max-width: 520px;
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2.75rem 2.25rem;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
    }
    .seal-wrapper {
      margin: 0 auto 1.75rem auto;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--accent-glow);
      border: 1px solid rgba(217, 119, 6, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 0 12px rgba(217, 119, 6, 0.15);
    }
    .seal-icon {
      width: 28px;
      height: 28px;
      stroke: var(--accent);
      fill: none;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--accent);
      background: rgba(217, 119, 6, 0.1);
      border: 1px solid rgba(217, 119, 6, 0.2);
      border-radius: 9999px;
      padding: 0.25rem 0.75rem;
      margin-bottom: 1.25rem;
    }
    h1 {
      font-size: 1.625rem;
      font-weight: 500;
      letter-spacing: -0.025em;
      color: var(--text);
      margin-bottom: 1rem;
      line-height: 1.3;
    }
    p.description {
      color: var(--muted);
      line-height: 1.7;
      font-size: 0.975rem;
      margin-bottom: 1.5rem;
    }
    .quote {
      border-left: 2px solid var(--accent);
      padding: 0.75rem 1rem;
      margin: 1.5rem 0;
      text-align: left;
      font-style: italic;
      color: #d6d3d1;
      font-size: 0.9rem;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 0 8px 8px 0;
    }
    .footer {
      font-size: 0.8125rem;
      color: var(--subtle);
      border-top: 1px solid var(--border);
      padding-top: 1.25rem;
      margin-top: 1.75rem;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="seal-wrapper">
      <svg class="seal-icon" viewBox="0 0 24 24">
        <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
        <path d="M12 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
        <path d="M12 14c-2.33 0-7 1.17-7 3.5V19h14v-1.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    </div>
    <span class="badge">Experiment Concluded</span>
    <h1>The Seal Has Closed</h1>
    <p class="description">
      Hermes Letters was an experiment exploring the tension of public links and ephemeral, one-time shared secrets.
      All letters have now been claimed, burned, or dissolved. The platform is permanently offline.
    </p>
    <div class="quote">
      &ldquo;A link anyone could hold, content only one person could ever take.&rdquo;
    </div>
    <div class="footer">
      Thank you to everyone who wrote, sent, and kept secrets.
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files and images
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
