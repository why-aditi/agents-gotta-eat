// Agents: the owner's agents with their key status. Register, rotate and revoke happen in client components
// that call the server actions in ./actions.
import { type Agent, AgentList } from "@gottaeat/schemas";
import { BotIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, apiFetch } from "@/lib/api";
import { AgentActions } from "./agent-actions";
import { RegisterDialog } from "./register-dialog";

type Loaded = { ok: true; agents: Agent[] } | { ok: false; message: string };

async function loadAgents(): Promise<Loaded> {
  try {
    const { agents } = await apiFetch(AgentList, "/v1/agents");
    return { ok: true, agents };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ApiError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: "Couldn't reach the api. Try again in a moment." };
  }
}

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

function StatusBadge({ agent }: { agent: Agent }) {
  if (agent.apiKeyPrefix === null) return <Badge variant="destructive">key revoked</Badge>;
  return <Badge variant={agent.status === "active" ? "secondary" : "outline"}>{agent.status}</Badge>;
}

function AgentsTable({ agents }: { agents: Agent[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Key</TableHead>
            <TableHead className="hidden sm:table-cell">Created</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => (
            <TableRow key={agent.id}>
              <TableCell className="max-w-64 truncate font-medium">
                <Link href={`/agents/${encodeURIComponent(agent.id)}`} className="hover:underline">
                  {agent.name}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{agent.kind}</Badge>
              </TableCell>
              <TableCell>
                <StatusBadge agent={agent} />
              </TableCell>
              <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                {agent.apiKeyPrefix ? `${agent.apiKeyPrefix}…` : "—"}
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                <time dateTime={agent.createdAt}>{dateFormat.format(new Date(agent.createdAt))}</time>
              </TableCell>
              <TableCell className="text-right">
                <AgentActions agent={{ id: agent.id, name: agent.name, apiKeyPrefix: agent.apiKeyPrefix }} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function AgentsPage() {
  const result = await loadAgents();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">Each agent has its own API key, wallet and mandate.</p>
        </div>
        {result.ok && result.agents.length > 0 && <RegisterDialog />}
      </div>

      {!result.ok ? (
        <Card role="alert" className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlertIcon className="size-4" aria-hidden /> Couldn&apos;t load your agents
            </CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : result.agents.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <BotIcon className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <CardTitle>No agents yet</CardTitle>
            <CardDescription>
              Register an agent to get its API key and MCP config. Then write a mandate that says what it may spend.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <RegisterDialog />
          </CardContent>
        </Card>
      ) : (
        <AgentsTable agents={result.agents} />
      )}
    </div>
  );
}
