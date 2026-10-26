import { PlayCircleIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, demoEnabled, githubEnabled, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Which providers exist depends on runtime env, so never prerender this page.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.email) redirect("/agents");

  const github = githubEnabled();
  const demo = demoEnabled();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Agents Gotta Eat</CardTitle>
          <CardDescription>Sign in to manage your agents, their mandates and approvals.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {github && (
            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo: "/agents" });
              }}
            >
              <Button type="submit" className="w-full">
                Sign in with GitHub
              </Button>
            </form>
          )}
          {demo && (
            <form
              action={async () => {
                "use server";
                await signIn("demo", { redirectTo: "/agents" });
              }}
            >
              <Button type="submit" variant={github ? "outline" : "default"} className="w-full">
                Continue as demo owner
              </Button>
            </form>
          )}
          {!github && !demo && (
            <p className="text-sm text-muted-foreground">
              No sign-in method is configured. Set <code>AUTH_GITHUB_ID</code> and <code>AUTH_GITHUB_SECRET</code>, or{" "}
              <code>DEMO_LOGIN=true</code>, on the web server.
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t text-sm">
          <Link
            href="/demo"
            className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
          >
            <PlayCircleIcon className="size-4" aria-hidden />
            Watch the demo
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
