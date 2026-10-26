// `/`: signed in → /agents; signed out → the featured demo replay when there is one, else /login.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchDemoStatus } from "@/lib/demo";
import { homeTarget } from "@/lib/demo-view";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);
  redirect(homeTarget(signedIn, signedIn ? null : await fetchDemoStatus()));
}
