// The branded 404. Signed-out visitors never reach it for app routes (middleware sends them to /login first); it
// serves signed-in users and the public routes.
import Link from "next/link";
import { Creature } from "@/components/creature/creature";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Not on the menu · Agents Gotta Eat" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <Creature id="agents-gotta-eat" name="Chef" mood="sulking" size="lg" still />
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight">That dish isn&apos;t on the menu</h1>
      <p className="text-muted-foreground">We couldn&apos;t find that page. It may have moved, or the link is wrong.</p>
      <Link href="/" className={buttonVariants()}>
        Back to the kitchen
      </Link>
    </main>
  );
}
