// Inline error state for pages whose api calls failed. Shows the api's message, never internals.
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api";

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "The api could not be reached. Try again in a moment.";
}

export function PageError({ title, error }: { title: string; error: unknown }) {
  if (!(error instanceof ApiError)) console.error(error);
  return (
    <Card role="alert" className="border-destructive/40">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{errorMessage(error)}</CardDescription>
      </CardHeader>
    </Card>
  );
}
