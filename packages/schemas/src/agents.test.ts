import { describe, expect, it } from "vitest";
import { Agent, CreateAgentRequest, CreateAgentResponse } from "./index";

const agent = {
  id: "agt_01",
  ownerId: "usr_01",
  name: "Patch",
  kind: "external",
  status: "active",
  rating: 40,
  skills: ["extract"],
  completedJobs: 2,
  apiKeyPrefix: "gte_agent_abcd",
  createdAt: "2026-10-12T00:00:00.000Z",
} as const;

describe("CreateAgentRequest", () => {
  it("trims the name and leaves kind optional", () => {
    expect(CreateAgentRequest.parse({ name: "  Patch  " })).toEqual({ name: "Patch" });
  });

  it("rejects blank, too long and unknown kinds", () => {
    expect(CreateAgentRequest.safeParse({ name: "   " }).success).toBe(false);
    expect(CreateAgentRequest.safeParse({ name: "x".repeat(81) }).success).toBe(false);
    expect(CreateAgentRequest.safeParse({ name: "x", kind: "rogue" }).success).toBe(false);
  });
});

describe("Agent", () => {
  it("accepts a null key prefix and rejects a fractional rating", () => {
    expect(Agent.parse({ ...agent, apiKeyPrefix: null }).apiKeyPrefix).toBeNull();
    expect(Agent.safeParse({ ...agent, rating: 4.5 }).success).toBe(false);
  });

  it("needs skills and a non-negative integer completedJobs", () => {
    expect(Agent.safeParse({ ...agent, skills: undefined }).success).toBe(false);
    expect(Agent.safeParse({ ...agent, completedJobs: -1 }).success).toBe(false);
    expect(Agent.safeParse({ ...agent, completedJobs: 1.5 }).success).toBe(false);
  });
});

describe("CreateAgentResponse", () => {
  it("allows a redacted (null) apiKey", () => {
    const body = {
      agent,
      apiKey: null,
      mcpConfig: {
        url: "http://localhost:3001/mcp",
        headers: { Authorization: "Bearer <your API key>" },
        stdio: {
          command: "npx",
          args: ["-y", "@gottaeat/mcp"],
          env: { GOTTAEAT_API_KEY: "<your API key>", GOTTAEAT_API_URL: "http://localhost:3001" },
        },
      },
    };
    expect(CreateAgentResponse.parse(body)).toEqual(body);
  });

  it("requires the stdio block with a placeholder key", () => {
    const mcpConfig = { url: "http://localhost:3001/mcp", headers: { Authorization: "Bearer <your API key>" } };
    expect(CreateAgentResponse.safeParse({ agent, apiKey: null, mcpConfig }).success).toBe(false);
    const leaked = {
      ...mcpConfig,
      stdio: { command: "npx", args: [], env: { GOTTAEAT_API_KEY: "gte_agent_real", GOTTAEAT_API_URL: "x" } },
    };
    expect(CreateAgentResponse.safeParse({ agent, apiKey: null, mcpConfig: leaked }).success).toBe(false);
  });
});
