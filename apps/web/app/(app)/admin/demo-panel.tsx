"use client";

// Admin "Demo" tab: record a live run (start/stop), save a window of past events as a recording, feature or
// delete recordings, and reset the demo (seed bounties + the house wallet). Delete and reset confirm first.
// Recording titles are admin text but still render as plain text.
import { CircleIcon, ExternalLinkIcon, RotateCcwIcon, SquareIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/actions";
import type { Recording } from "@/lib/demo-schemas";
import { formatDateTime } from "../_lib/format";
import {
  deleteRecording,
  featureRecording,
  resetDemo,
  saveWindow,
  startRecording,
  stopRecording,
} from "./demo-actions";

export const RESET_OFF_MESSAGE =
  "Reset is turned off on this api: it needs ALLOW_DEV_FUNDING=true and ALLOW_DEV_CREDIT=true.";

// A `datetime-local` value ("2026-10-26T12:00") read as UTC, or null.
export function utcInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const date = new Date(`${value.length === 16 ? `${value}:00` : value}.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

type Confirm = { kind: "delete"; recording: Recording } | { kind: "reset" };

export function DemoPanel({ recordings }: { recordings: Recording[] }) {
  const uid = useId();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [windowTitle, setWindowTitle] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [windowError, setWindowError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>({ kind: "reset" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetKey, setResetKey] = useState(() => crypto.randomUUID());
  const [resetOff, setResetOff] = useState(false);
  const active = recordings.find((r) => r.endedAt === null) ?? null;

  // Runs an action; toasts its error, or `success` and then `after` on success.
  function run(action: () => Promise<ActionResult<null>>, success: string, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        after?.();
      } else {
        toast.error(result.message);
      }
    });
  }

  function onStart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return toast.error("Give the recording a title.");
    run(
      () => startRecording(title.trim()),
      "Recording started.",
      () => setTitle(""),
    );
  }

  function onSaveWindow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fromIso = utcInputToIso(from);
    const toIso = utcInputToIso(to);
    if (!windowTitle.trim()) return setWindowError("Give the recording a title.");
    if (!fromIso || !toIso) return setWindowError("Enter both times.");
    if (fromIso >= toIso) return setWindowError("“From” must be before “to”.");
    setWindowError(null);
    run(
      () => saveWindow(windowTitle.trim(), fromIso, toIso),
      "Window saved as a recording.",
      () => {
        setWindowTitle("");
        setFrom("");
        setTo("");
      },
    );
  }

  function onConfirm() {
    startTransition(async () => {
      if (confirm.kind === "delete") {
        const result = await deleteRecording(confirm.recording.id);
        if (result.ok) {
          setConfirmOpen(false);
          toast.success("Recording deleted.");
        } else {
          toast.error(result.message);
        }
        return;
      }
      const result = await resetDemo(resetKey);
      if (result.ok) {
        setConfirmOpen(false);
        setResetKey(crypto.randomUUID());
        toast.success("Demo reset: seed bounties are open and the house wallet is back to $60.00.");
      } else if (result.code === "not_found") {
        setConfirmOpen(false);
        setResetOff(true);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {active ? (
                <>
                  <CircleIcon className="size-3 animate-pulse fill-red-500 text-red-500" aria-hidden />
                  Recording now
                </>
              ) : (
                "Record a live run"
              )}
            </CardTitle>
            <CardDescription>
              {active
                ? "Public events are being captured. Owner-only events never are."
                : "Captures every public event until you stop. One recording at a time."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {active ? (
              <div className="flex flex-wrap items-center justify-between gap-3" data-testid="active-recording">
                <div className="min-w-0 text-sm">
                  <p className="font-medium break-words">{active.title}</p>
                  <p className="text-muted-foreground tabular-nums">
                    Since {formatDateTime(active.startedAt)} · {active.eventCount}{" "}
                    {active.eventCount === 1 ? "event" : "events"}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() => run(stopRecording, "Recording stopped.")}
                >
                  <SquareIcon aria-hidden /> Stop
                </Button>
              </div>
            ) : (
              <form onSubmit={onStart} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor={`${uid}-title`}>Title</Label>
                  <Input
                    id={`${uid}-title`}
                    autoComplete="off"
                    maxLength={200}
                    placeholder="Arena run, Nov 10"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={pending}>
                  <CircleIcon className="fill-current" aria-hidden /> Start
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Save a window</CardTitle>
            <CardDescription>Turn public events that already happened into a recording. Times are UTC.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSaveWindow} noValidate className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor={`${uid}-wtitle`}>Title</Label>
                <Input
                  id={`${uid}-wtitle`}
                  autoComplete="off"
                  maxLength={200}
                  value={windowTitle}
                  onChange={(e) => setWindowTitle(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${uid}-from`}>From (UTC)</Label>
                  <Input
                    id={`${uid}-from`}
                    type="datetime-local"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${uid}-to`}>To (UTC)</Label>
                  <Input id={`${uid}-to`} type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="outline" disabled={pending}>
                  Save window
                </Button>
                {windowError && <p className="text-sm text-destructive">{windowError}</p>}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <section aria-label="Recordings" className="space-y-2">
        <h2 className="text-base font-semibold">Recordings</h2>
        {recordings.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No recordings yet. Record a run, save a window, or run <code>pnpm demo:import</code>.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead>Recorded</TableHead>
                  <TableHead>Featured</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordings.map((r) => (
                  <TableRow key={r.id} data-testid="recording-row">
                    <TableCell className="max-w-64 font-medium break-words whitespace-normal">
                      {r.title}
                      {r.endedAt === null && (
                        <Badge variant="destructive" className="ml-2">
                          recording
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{r.source}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.eventCount}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(r.startedAt)}</TableCell>
                    <TableCell>{r.featured ? <Badge>featured</Badge> : null}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/demo?recording=${encodeURIComponent(r.id)}`} target="_blank">
                            Watch <ExternalLinkIcon aria-hidden />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending || r.featured || r.endedAt === null}
                          aria-label={`Feature ${r.title}`}
                          onClick={() => run(() => featureRecording(r.id), `“${r.title}” is now the featured replay.`)}
                        >
                          <StarIcon aria-hidden /> Feature
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={pending}
                          aria-label={`Delete ${r.title}`}
                          onClick={() => {
                            setConfirm({ kind: "delete", recording: r });
                            setConfirmOpen(true);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reset demo</CardTitle>
          <CardDescription>
            Opens the seed bounties that aren&apos;t open yet and tops the house owner&apos;s wallet back up to $60.00
            with one dev credit. Dev environments only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetOff ? (
            <p role="status" className="text-sm text-muted-foreground">
              {RESET_OFF_MESSAGE}
            </p>
          ) : (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                setConfirm({ kind: "reset" });
                setConfirmOpen(true);
              }}
            >
              <RotateCcwIcon aria-hidden /> Reset demo
            </Button>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={(next) => !next && !pending && setConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm.kind === "delete" ? `Delete “${confirm.recording.title}”?` : "Reset the demo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm.kind === "delete"
                ? "The recording and its events are deleted for good. If it is featured, /demo has nothing to play until you feature another."
                : "Seed bounties that aren't open are created and opened, and the house wallet is topped up to $60.00."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            {/* A plain button, not AlertDialogAction: the dialog stays open until the api answers. */}
            <Button
              variant={confirm.kind === "delete" ? "destructive" : "default"}
              disabled={pending}
              aria-busy={pending || undefined}
              onClick={onConfirm}
            >
              {confirm.kind === "delete" ? "Delete recording" : "Reset demo"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
