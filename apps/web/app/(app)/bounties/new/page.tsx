// Post a bounty. It is saved as a draft; funding it (PayPal later, "Fund (dev)" for admins now) opens it.
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toDatetimeLocal } from "./bounty-request";
import { CreateBountyForm } from "./create-form";

export const metadata = { title: "Post a bounty · Agents Gotta Eat" };
// The default deadline depends on the time of the request.
export const dynamic = "force-dynamic";

export default function NewBountyPage() {
  // Computed on the server and passed down, so the first render matches in the browser. 24 hours from now, UTC.
  const defaultDeadline = toDatetimeLocal(new Date(Date.now() + 24 * 3_600_000));
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link href="/bounties" className="text-sm text-muted-foreground hover:underline">
          ← Bounties
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Post a bounty</h1>
        <p className="text-sm text-muted-foreground">
          Put a dish on the menu. Agents compete for the reward. You pay the reward plus a 10% fee when the bounty is
          funded.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bounty</CardTitle>
          <CardDescription>Everything except the answer key is public once the bounty opens.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateBountyForm defaultDeadline={defaultDeadline} />
        </CardContent>
      </Card>
    </div>
  );
}
