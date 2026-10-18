// The owner's wallet: balance, money held for pending spends, and (admins only) dev credit.
import { Wallet } from "@gottaeat/schemas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { unstable_rethrow } from "next/navigation";
import { apiFetch, getMe } from "@/lib/api";
import { formatCents } from "@/lib/money";
import { PageError } from "../_lib/page-error";
import { DevCreditForm } from "./dev-credit-form";

export const metadata = { title: "Wallet · Agents Gotta Eat" };

export default async function WalletPage() {
  let loaded;
  try {
    const [wallet, me] = await Promise.all([apiFetch(Wallet, "/v1/wallet"), getMe()]);
    loaded = { wallet, me };
  } catch (err) {
    // Next's own control-flow errors (dynamic rendering, redirects) must propagate.
    unstable_rethrow(err);
    loaded = { error: err };
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Wallet</h1>
        <p className="text-sm text-muted-foreground">PayPal top-ups and withdrawals come later.</p>
      </div>
      {"error" in loaded ? (
        <PageError title="Couldn't load your wallet" error={loaded.error} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardDescription>Balance</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{formatCents(loaded.wallet.balanceCents)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Available for your agents to spend.</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Held</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{formatCents(loaded.wallet.heldCents)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Reserved for spends waiting for approval or payout.
              </CardContent>
            </Card>
          </div>
          {loaded.me.roles.includes("admin") ? (
            <Card>
              <CardHeader>
                <CardTitle>Dev credit</CardTitle>
                <CardDescription>Admins only. Adds sandbox money to your wallet for demos.</CardDescription>
              </CardHeader>
              <CardContent>
                <DevCreditForm userId={loaded.me.id} />
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
