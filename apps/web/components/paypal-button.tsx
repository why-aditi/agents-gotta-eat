"use client";

// "Pay with PayPal" for the PayPal JS SDK v6 (sandbox). v6 renders no button, so this is our own shadcn Button.
// The browser only ever handles an order id: createOrder asks the server for one, PayPal approves it, and
// onApproved asks the server to authorize or capture it. Nothing here decides what happened; the server does.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Approval = { orderId: string };
type OneTimeSession = {
  start: (options: { presentationMode: "auto" }, order: Promise<Approval>) => Promise<void>;
};
type SdkInstance = {
  findEligibleMethods: () => Promise<{ isEligible: (method: string) => boolean }>;
  createPayPalOneTimePaymentSession: (callbacks: {
    onApprove: (data: Approval) => Promise<void> | void;
    onCancel: () => void;
    onError: (error: unknown) => void;
  }) => Promise<OneTimeSession> | OneTimeSession;
};
declare global {
  interface Window {
    paypal?: { createInstance: (options: { clientId: string; components: string[] }) => Promise<SdkInstance> };
  }
}

const SDK_URL = "https://www.sandbox.paypal.com/web-sdk/v6/core";
const SCRIPT_ID = "paypal-web-sdk-v6";

// One script tag and one instance per page, however many buttons or StrictMode remounts ask for them.
let sdkScript: Promise<void> | null = null;
let sdkInstance: { clientId: string; promise: Promise<SdkInstance> } | null = null;

function loadScript(): Promise<void> {
  if (window.paypal) return Promise.resolve();
  sdkScript ??= new Promise<void>((resolve, reject) => {
    const script = document.getElementById(SCRIPT_ID) ?? document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      sdkScript = null;
      script.remove();
      reject(new Error("Couldn't load PayPal. Check your connection and reload."));
    });
    if (!script.id) {
      script.id = SCRIPT_ID;
      (script as HTMLScriptElement).async = true;
      (script as HTMLScriptElement).src = SDK_URL;
      document.head.appendChild(script);
    }
  });
  return sdkScript;
}

function getInstance(clientId: string): Promise<SdkInstance> {
  if (sdkInstance?.clientId !== clientId) {
    const promise = loadScript().then(() =>
      window.paypal!.createInstance({ clientId, components: ["paypal-payments"] }),
    );
    sdkInstance = { clientId, promise };
    promise.catch(() => {
      if (sdkInstance?.promise === promise) sdkInstance = null;
    });
  }
  return sdkInstance.promise;
}

type Setup = "loading" | "ready" | "not_eligible" | "failed";
type Busy = null | "creating" | "awaiting" | "confirming";

const BUSY_LABEL = { creating: "Creating order…", awaiting: "Waiting for PayPal…", confirming: "Confirming…" } as const;

export function PayPalButton({
  label = "Pay with PayPal",
  disabled,
  createOrder,
  onApproved,
}: {
  label?: string;
  disabled?: boolean;
  createOrder: () => Promise<{ orderId: string } | { error: string }>;
  onApproved: (orderId: string) => Promise<{ ok: true; message: string } | { ok: false; message: string }>;
}) {
  const router = useRouter();
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const [setup, setSetup] = useState<Setup>("loading");
  const [session, setSession] = useState<OneTimeSession | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  // The session is made once, so callbacks reach the latest props and report at most one error per attempt.
  const latest = useRef({ onApproved, router });
  latest.current = { onApproved, router };
  const reported = useRef(false);

  useEffect(() => {
    if (!clientId) return;
    let stale = false;

    function fail(message: string) {
      if (reported.current) return;
      reported.current = true;
      toast.error(message);
    }

    getInstance(clientId)
      .then(async (sdk) => {
        const methods = await sdk.findEligibleMethods();
        if (!methods.isEligible("paypal")) return stale || setSetup("not_eligible");
        const created = await sdk.createPayPalOneTimePaymentSession({
          onApprove: async ({ orderId }) => {
            setBusy("confirming");
            try {
              const result = await latest.current.onApproved(orderId);
              if (result.ok) toast.success(result.message);
              else toast.error(result.message);
            } catch {
              toast.error("Something went wrong confirming the payment. Check your wallet before trying again.");
            }
            setBusy(null);
            latest.current.router.refresh();
          },
          onCancel: () => {
            setBusy(null);
            toast("Payment cancelled. Nothing was charged.");
          },
          onError: (error) => {
            setBusy(null);
            fail(error instanceof Error ? error.message : "PayPal hit a problem. Nothing was charged.");
          },
        });
        if (stale) return;
        setSession(created);
        setSetup("ready");
      })
      .catch(() => stale || setSetup("failed"));
    return () => {
      stale = true;
    };
  }, [clientId]);

  if (!clientId) {
    return (
      <div className="space-y-2">
        <Button type="button" disabled>
          {label}
        </Button>
        <p className="text-sm text-muted-foreground">PayPal is not configured</p>
      </div>
    );
  }

  async function click() {
    if (!session) return;
    reported.current = false;
    setBusy("creating");
    // Not awaited: PayPal needs start() inside the click to open its window, and takes the order as a promise.
    const order = createOrder().then((result) => {
      if ("error" in result) throw new Error(result.error);
      setBusy("awaiting");
      return { orderId: result.orderId };
    });
    try {
      await session.start({ presentationMode: "auto" }, order);
    } catch (err) {
      setBusy(null);
      if (!reported.current) {
        reported.current = true;
        toast.error(err instanceof Error ? err.message : "PayPal hit a problem. Nothing was charged.");
      }
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={click}
        disabled={disabled || setup !== "ready" || busy !== null}
        aria-busy={busy !== null || setup === "loading" || undefined}
      >
        {busy ? BUSY_LABEL[busy] : label}
      </Button>
      {setup === "loading" ? <p className="text-sm text-muted-foreground">Loading PayPal…</p> : null}
      {setup === "not_eligible" ? (
        <p className="text-sm text-muted-foreground">PayPal isn&apos;t available for this browser or account.</p>
      ) : null}
      {setup === "failed" ? (
        <p className="text-sm text-destructive">Couldn&apos;t load PayPal. Reload the page to try again.</p>
      ) : null}
    </div>
  );
}
