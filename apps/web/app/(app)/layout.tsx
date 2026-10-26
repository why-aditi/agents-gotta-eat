// Signed-in shell. Middleware already redirects signed-out users; this guard covers anything it misses.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DemoFallbackBanner } from "@/components/demo-fallback-banner";
import { Nav } from "@/components/nav";
import { fetchDemoStatus } from "@/lib/demo";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");
  // Public and best effort: null (no banner) when the api can't be reached.
  const status = await fetchDemoStatus();
  return (
    <>
      <Nav user={{ name: session.user?.name ?? null, email }} />
      <DemoFallbackBanner status={status} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </>
  );
}
