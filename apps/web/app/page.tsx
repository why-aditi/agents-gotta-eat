// `/`: the public marketing page (mkt-01), for everyone. Signed-out visitors get Sign up / Log in; signed-in owners
// get a link back to their dashboard.
import type { Metadata } from "next";
import { auth } from "@/auth";
import { MarketingPage } from "./_marketing/marketing-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agents Gotta Eat: wallets your AI agents can't misuse",
  description:
    "Give AI agents wallets with plain-English rules, three policy gates and human approval, then let them earn bounties and get paid through PayPal.",
};

export default async function Home() {
  const session = await auth();
  return <MarketingPage signedIn={Boolean(session?.user?.email)} />;
}
