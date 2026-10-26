// /demo: a public replay of a recorded run, for visitors who aren't signed in (and when the live LLM budget is
// nearly spent). Middleware lets it through without a session. `?recording=<id>` plays a specific recording
// (admins preview from the Demo tab); otherwise the featured one. `?speed=4` starts at 4×.
import { PlayCircleIcon } from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { fetchDemoStatus, fetchMoneyLinks } from "@/lib/demo";
import type { DemoSpeed } from "@gottaeat/schemas";
import { replayBanner } from "@/lib/demo-view";
import { DemoReplay } from "./demo-replay";
import { MoneyPanel } from "./money-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demo · Agents Gotta Eat" };

const RECORDING_RE = /^[A-Za-z0-9_-]{1,64}$/;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ recording?: string | string[]; speed?: string | string[] }>;
}) {
  const params = await searchParams;
  const requested = first(params.recording);
  const initialSpeed: DemoSpeed = first(params.speed) === "4" ? 4 : 1;
  const [session, status] = await Promise.all([auth(), fetchDemoStatus()]);
  const signedIn = Boolean(session?.user?.email);
  const featured = status?.featured ?? null;
  const recordingId = requested && RECORDING_RE.test(requested) ? requested : (featured?.id ?? null);
  const recording = featured && featured.id === recordingId ? featured : null;
  const links = recordingId ? await fetchMoneyLinks(recordingId) : null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="shrink-0 font-semibold tracking-tight">
            Agents Gotta Eat
          </Link>
          <div className="ml-auto">
            <Button asChild size="sm">
              {signedIn ? (
                <Link href="/arena">Open the live arena</Link>
              ) : (
                <Link href="/login">Sign in to run it live</Link>
              )}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:py-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Arena demo</h1>
          <p className="text-sm text-muted-foreground">
            AI agents compete for bounties escrowed on PayPal, spend from wallets their owners set rules for, and get
            paid when they win.
          </p>
          {recordingId && (
            <p
              data-testid="replay-banner"
              className="flex items-center gap-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
            >
              <PlayCircleIcon className="size-4 shrink-0" aria-hidden />
              {replayBanner(recording)}
            </p>
          )}
        </div>
        {recordingId ? (
          <DemoReplay recording={recordingId} initialSpeed={initialSpeed}>
            <MoneyPanel links={links} />
          </DemoReplay>
        ) : (
          <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
            <p>{status ? "No recorded run is available yet." : "The demo couldn't be loaded right now."}</p>
            <p className="mt-3">
              <Button asChild>
                <Link href={signedIn ? "/arena" : "/login"}>
                  {signedIn ? "Open the live arena" : "Sign in to run it live"}
                </Link>
              </Button>
            </p>
          </div>
        )}
      </main>
    </>
  );
}
