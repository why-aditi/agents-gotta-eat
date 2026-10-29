// The owner's wallet: balance, money held for pending spends, and (admins only) dev credit. ui-02: a balance card
// that counts to new values, and the activity list from GET /v1/wallet/activity.
import { PayoutEmail, PayoutList, Wallet, WalletActivity } from "@gottaeat/schemas";
import { WalletIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { unstable_rethrow } from "next/navigation";
import { ActivityList } from "@/components/app/activity-list";
import { AnimatedMoney } from "@/components/app/animated-money";
import { Money } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { apiFetch, getMe } from "@/lib/api";
import { SUBTITLE } from "@/lib/kitchen";
import { PageError } from "../_lib/page-error";
import { DevCreditForm } from "./dev-credit-form";
import { FrozenBanner } from "./frozen-banner";
import { TopupCard } from "./topup-card";
import { WithdrawCard } from "./withdraw-card";

export const metadata = { title: "Wallet · Agents Gotta Eat" };

// Kept apart from the wallet itself: if these two calls fail the balance still shows, with an error where the
// withdraw card would be.
async function loadWithdrawals() {
  try {
    const [email, list] = await Promise.all([
      apiFetch(PayoutEmail, "/v1/wallet/payout-email"),
      apiFetch(PayoutList, "/v1/wallet/withdrawals"),
    ]);
    return { email: email.email, payouts: list.payouts };
  } catch (err) {
    unstable_rethrow(err);
    return { error: err };
  }
}

async function loadActivity() {
  try {
    return await apiFetch(WalletActivity, "/v1/wallet/activity?limit=50");
  } catch (err) {
    unstable_rethrow(err);
    return { error: err };
  }
}

export default async function WalletPage() {
  let loaded;
  try {
    const [wallet, me] = await Promise.all([apiFetch(Wallet, "/v1/wallet"), getMe()]);
    const [withdrawals, activity] = await Promise.all([loadWithdrawals(), loadActivity()]);
    loaded = { wallet, me, withdrawals, activity };
  } catch (err) {
    // Next's own control-flow errors (dynamic rendering, redirects) must propagate.
    unstable_rethrow(err);
    loaded = { error: err };
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Wallet">{SUBTITLE.wallet}</PageHeader>
      {"error" in loaded ? (
        <PageError title="Couldn't load your wallet" error={loaded.error} />
      ) : (
        <>
          <FrozenBanner owedCents={loaded.wallet.owedCents} />
          <section aria-label="Balance" className="sticker relative isolate overflow-hidden bg-snack-soft p-6 sm:p-8">
            {/* The pantry shelf: decoration only. */}
            <div
              aria-hidden
              className="absolute top-6 right-6 hidden flex-col items-end gap-1 text-4xl select-none sm:flex"
            >
              <span>🥫🍯🥖</span>
              <span className="h-1.5 w-40 rounded-full bg-outline/30" />
              <span>🧀🍎🥨🍪</span>
              <span className="h-1.5 w-48 rounded-full bg-outline/30" />
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <WalletIcon className="size-4" aria-hidden /> Available to eat
            </p>
            <AnimatedMoney
              cents={loaded.wallet.balanceCents}
              data-testid="wallet-balance"
              className="font-display mt-2 block text-6xl font-semibold tracking-tight sm:text-7xl"
            />
            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">On hold</dt>
                <dd className="mt-0.5 text-lg">
                  <Money cents={loaded.wallet.heldCents} className="text-flag" />
                </dd>
                <dd className="text-xs text-muted-foreground">Waiting on approvals or payouts</dd>
              </div>
              {loaded.wallet.owedCents > 0 && (
                <div>
                  <dt className="text-muted-foreground">Owed</dt>
                  <dd className="mt-0.5 text-lg">
                    <Money cents={loaded.wallet.owedCents} className="text-deny" />
                  </dd>
                  <dd className="text-xs text-muted-foreground">After a PayPal reversal</dd>
                </div>
              )}
            </dl>
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <Card className="order-2 lg:order-1">
              <CardHeader>
                <CardTitle>Meals and deliveries</CardTitle>
                <CardDescription>Every cent in and out of the pantry, newest first.</CardDescription>
              </CardHeader>
              <CardContent>
                {"error" in loaded.activity ? (
                  <PageError title="Couldn't load activity" error={loaded.activity.error} />
                ) : (
                  <ActivityList
                    items={loaded.activity.items}
                    grouped
                    empty="Nothing yet. Top up with PayPal and your agents can start spending."
                  />
                )}
              </CardContent>
            </Card>
            <div className="order-1 space-y-6 lg:order-2">
              <TopupCard />
              {"error" in loaded.withdrawals ? (
                <PageError title="Couldn't load withdrawals" error={loaded.withdrawals.error} />
              ) : (
                <WithdrawCard payoutEmail={loaded.withdrawals.email} payouts={loaded.withdrawals.payouts} />
              )}
              {loaded.me.roles.includes("admin") ? (
                <Card className="border-dashed bg-muted/30 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-sm">Developer tools</CardTitle>
                    <CardDescription>Admins only. Adds sandbox money to your wallet for demos.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DevCreditForm userId={loaded.me.id} />
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
