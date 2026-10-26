"use client";

// The one-time view of a freshly issued API key, plus (after registration) the MCP configs with the key
// filled in. The key lives only in the parent dialog's state; closing the dialog drops it.
import type { McpConfig } from "@gottaeat/schemas";
import { CopyIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { httpConfigJson, stdioConfigJson } from "./mcp-config";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  } catch {
    toast.error("Couldn't copy. Select the text and copy it by hand.");
  }
}

function ConfigBlock({ label, json }: { label: string; json: string }) {
  return (
    <div className="relative">
      <pre
        aria-label={`${label} config`}
        className="max-h-56 overflow-auto rounded-md border bg-muted p-3 pr-12 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap"
      >
        {json}
      </pre>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="absolute top-2 right-2 size-8"
        aria-label={`Copy ${label} config`}
        onClick={() => void copyText(json)}
      >
        <CopyIcon />
      </Button>
    </div>
  );
}

export function KeyReveal({ apiKey, mcpConfig }: { apiKey: string | null; mcpConfig?: McpConfig }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {apiKey ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="one-time-api-key">API key</Label>
            <div className="flex gap-2">
              <Input
                id="one-time-api-key"
                readOnly
                value={apiKey}
                className="font-mono text-xs md:text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button type="button" variant="outline" aria-label="Copy API key" onClick={() => void copyText(apiKey)}>
                <CopyIcon /> Copy
              </Button>
            </div>
          </div>
          <p
            role="note"
            className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
          >
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong>Copy it now. You won&apos;t see it again.</strong> We only store a hash. If you lose it, rotate
              the key.
            </span>
          </p>
        </>
      ) : (
        <p role="note" className="rounded-md border bg-muted p-3 text-sm">
          This key was already shown when the request first ran, and it can&apos;t be shown again. If you didn&apos;t
          save it, rotate the key from the agents table to get a new one.
        </p>
      )}

      {mcpConfig && (
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-sm font-medium">Connect over MCP</h3>
          <Tabs defaultValue="http" className="min-w-0">
            <TabsList>
              <TabsTrigger value="http">HTTP</TabsTrigger>
              <TabsTrigger value="stdio">stdio</TabsTrigger>
            </TabsList>
            <TabsContent value="http" className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">For clients with Streamable HTTP support.</p>
              <ConfigBlock label="HTTP" json={httpConfigJson(mcpConfig, apiKey)} />
            </TabsContent>
            <TabsContent value="stdio" className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                For Claude Desktop: add this to <code>claude_desktop_config.json</code>.
              </p>
              <ConfigBlock label="stdio" json={stdioConfigJson(mcpConfig, apiKey)} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
