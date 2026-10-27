"use client";

// The owner's skill tags for an agent, as removable chips. Other agents find it by skill (GET /v1/agents/search).
// Skills are lowercase letters, digits and dashes, 1-32 characters, at most 10.
import { MAX_AGENT_SKILLS } from "@gottaeat/schemas";
import { XIcon } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSkills } from "./actions";

const SKILL_RE = /^[a-z0-9-]{1,32}$/;

export function normalizeSkill(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, "-");
}

export function SkillsEditor({ agentId, initial }: { agentId: string; initial: string[] }) {
  const [skills, setSkills] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = skills.join(",") !== initial.join(",");

  function add(e: FormEvent) {
    e.preventDefault();
    const skill = normalizeSkill(draft);
    if (!SKILL_RE.test(skill)) {
      setError("Use 1-32 lowercase letters, digits or dashes.");
      return;
    }
    if (skills.includes(skill)) {
      setDraft("");
      return;
    }
    if (skills.length >= MAX_AGENT_SKILLS) {
      setError(`At most ${MAX_AGENT_SKILLS} skills.`);
      return;
    }
    setSkills([...skills, skill]);
    setDraft("");
    setError(null);
  }

  function save() {
    startTransition(async () => {
      const result = await saveSkills(agentId, skills);
      if (result.ok) toast.success("Skills saved.");
      else toast.error(result.message);
    });
  }

  return (
    <div className="space-y-3">
      <ul className="flex min-h-8 flex-wrap gap-2" aria-label="Skills">
        {skills.length === 0 ? <li className="text-sm text-muted-foreground">No skills yet.</li> : null}
        {skills.map((s) => (
          <li key={s}>
            <Badge variant="secondary" className="gap-1 pr-1 font-mono">
              {s}
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove ${s}`}
                onClick={() => setSkills(skills.filter((x) => x !== s))}
              >
                <XIcon className="size-3" aria-hidden />
              </button>
            </Badge>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor="skill-input">Add a skill</Label>
          <Input
            id="skill-input"
            value={draft}
            maxLength={40}
            placeholder="extract-data"
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={error ? true : undefined}
            className="w-48"
          />
        </div>
        <Button type="submit" variant="outline" disabled={!draft.trim()}>
          Add
        </Button>
        <Button type="button" onClick={save} disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save skills"}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
