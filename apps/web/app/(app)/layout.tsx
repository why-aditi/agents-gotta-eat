// Signed-in shell. Middleware already redirects signed-out users; this guard covers anything it misses.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DemoFallbackBanner } from "@/components/demo-fallback-banner";
import { AppShell } from "@/components/nav";
import { fetchDemoStatus } from "@/lib/demo";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");
  // Public and best effort: null (no banner) when the api can't be reached.
  const status = await fetchDemoStatus();
  return (
    <AppShell user={{ name: session.user?.name ?? null, email }}>
      <DemoFallbackBanner status={status} />
      <main>{children}</main>
    </AppShell>
  );
}
