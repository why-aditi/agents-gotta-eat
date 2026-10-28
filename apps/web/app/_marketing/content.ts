// mkt-01: the marketing page's numbers. Market stats are quoted from their sources (linked on the page); proof stats
// are this repo's own and say where they come from, so they can be re-checked before the video.

export interface MarketStat {
  value: string;
  label: string;
  source: string;
  href: string;
}

export const MARKET_STATS: MarketStat[] = [
  {
    value: "$300–500B",
    label: "US agentic commerce by 2030: 15–25% of all e-commerce, bought by AI agents",
    source: "Bain & Company, 2030 forecast",
    href: "https://www.bain.com/insights/2030-forecast-how-agentic-ai-will-reshape-us-retail-snap-chart/",
  },
  {
    value: "15%",
    label: "of day-to-day work decisions made autonomously by agentic AI by 2028, up from 0% in 2024",
    source: "Gartner, Top Strategic Technology Trends",
    href: "https://www.gartner.com/en/newsroom/press-releases/2024-10-21-gartner-identifies-the-top-10-strategic-technology-trends-for-2025",
  },
  {
    value: "#1",
    label: "risk for LLM applications: prompt injection, the attack that makes an agent spend what it shouldn't",
    source: "OWASP Top 10 for LLM Applications, LLM01:2025",
    href: "https://genai.owasp.org/llmrisk/llm01-prompt-injection/",
  },
];

// The gap we close, in Gartner's words: projects die on risk, not on capability.
export const CANCELLATION_STAT: MarketStat = {
  value: "40%+",
  label: "of agentic AI projects will be cancelled by 2027, inadequate risk controls among the reasons",
  source: "Gartner, June 2025",
  href: "https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027",
};

export interface ProofStat {
  // A number to count up to, with optional text around it.
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  how: string;
}

export const PROOF_STATS: ProofStat[] = [
  {
    value: 0,
    label: "wrong payouts from 40 injection attacks",
    how: "Red-team suite in CI against a model that obeys every injection (apps/api/src/redteam)",
  },
  {
    value: 0,
    label: "double spends with 50 spends fired at once",
    how: "k6 load test on one $10 wallet: exactly 10 settle, the ledger reconciles (tests/load)",
  },
  {
    value: 1031,
    label: "api tests, plus 15 end-to-end browser flows",
    how: "Vitest and Playwright, run on every pull request",
  },
  {
    value: 3,
    label: "gates on every spend, hard rules always before any AI",
    how: "An LLM can tighten a decision, never loosen one (policy/combine.ts)",
  },
  {
    value: 7,
    label: "PayPal APIs: Orders, Payments, Payouts, Refunds, Webhooks, Transaction Search, Agent Toolkit",
    how: "One module calls PayPal, every call with a PayPal-Request-Id",
  },
  {
    value: 15,
    label: "MCP tools, so any agent can earn and spend",
    how: "Each tool maps to one REST call with the same auth and policy",
  },
];
