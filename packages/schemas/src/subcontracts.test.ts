import { describe, expect, it } from "vitest";
import {
  AcceptSubcontractRequest,
  AgentSearchQuery,
  ArenaEvent,
  CreateSubcontractRequest,
  DeliverSubcontractRequest,
  EVENT_SCOPE,
  RejectSubcontractRequest,
  UpdateAgentRequest,
} from "./index";

const hire = { workerAgentId: "agt_2", task: "Extract the totals", amountCents: 300, reason: "Need help" };

describe("CreateSubcontractRequest", () => {
  it("takes integer cents, a task of at most 4,096 characters and 1-1440 minutes", () => {
    expect(CreateSubcontractRequest.parse(hire)).toEqual(hire);
    expect(CreateSubcontractRequest.safeParse({ ...hire, amountCents: 1.5 }).success).toBe(false);
    expect(CreateSubcontractRequest.safeParse({ ...hire, amountCents: 0 }).success).toBe(false);
    expect(CreateSubcontractRequest.safeParse({ ...hire, task: "x".repeat(4097) }).success).toBe(false);
    expect(CreateSubcontractRequest.safeParse({ ...hire, task: "   " }).success).toBe(false);
    expect(CreateSubcontractRequest.safeParse({ ...hire, deliverByMinutes: 0 }).success).toBe(false);
    expect(CreateSubcontractRequest.safeParse({ ...hire, deliverByMinutes: 1441 }).success).toBe(false);
    expect(CreateSubcontractRequest.safeParse({ ...hire, deliverByMinutes: 1440 }).success).toBe(true);
    expect(CreateSubcontractRequest.safeParse({ ...hire, reason: "" }).success).toBe(false);
  });
});

describe("DeliverSubcontractRequest", () => {
  it("caps the deliverable at 64 KB of UTF-8", () => {
    expect(DeliverSubcontractRequest.safeParse({ deliverable: "x".repeat(65_536) }).success).toBe(true);
    expect(DeliverSubcontractRequest.safeParse({ deliverable: "x".repeat(65_537) }).success).toBe(false);
    // 32,769 two-byte characters: under 65,536 characters but over 65,536 bytes.
    expect(DeliverSubcontractRequest.safeParse({ deliverable: "é".repeat(32_769) }).success).toBe(false);
    expect(DeliverSubcontractRequest.safeParse({ deliverable: "" }).success).toBe(false);
  });
});

describe("Accept and reject", () => {
  it("rates 1-5 in whole stars and needs a reason of at most 500 characters", () => {
    expect(AcceptSubcontractRequest.parse({})).toEqual({});
    expect(AcceptSubcontractRequest.safeParse({ rating: 0 }).success).toBe(false);
    expect(AcceptSubcontractRequest.safeParse({ rating: 6 }).success).toBe(false);
    expect(AcceptSubcontractRequest.safeParse({ rating: 4.5 }).success).toBe(false);
    expect(RejectSubcontractRequest.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
    expect(RejectSubcontractRequest.safeParse({ reason: " " }).success).toBe(false);
  });
});

describe("skills", () => {
  it("lowercases and trims each skill, allows at most 10 of [a-z0-9-]{1,32}", () => {
    expect(UpdateAgentRequest.parse({ skills: [" Extract-Data ", "ocr2"] })).toEqual({
      skills: ["extract-data", "ocr2"],
    });
    expect(UpdateAgentRequest.safeParse({ skills: ["has space"] }).success).toBe(false);
    expect(UpdateAgentRequest.safeParse({ skills: ["x".repeat(33)] }).success).toBe(false);
    expect(UpdateAgentRequest.safeParse({ skills: [""] }).success).toBe(false);
    expect(UpdateAgentRequest.safeParse({ skills: Array.from({ length: 11 }, (_, i) => `s${i}`) }).success).toBe(false);
  });

  it("search coerces minRating from the query string, in tenths", () => {
    expect(AgentSearchQuery.parse({ skill: "OCR", minRating: "40" })).toEqual({ skill: "ocr", minRating: 40 });
    expect(AgentSearchQuery.safeParse({ minRating: "51" }).success).toBe(false);
    expect(AgentSearchQuery.safeParse({ minRating: "4.5" }).success).toBe(false);
  });
});

describe("subcontract events", () => {
  it("are public and carry no task or deliverable", () => {
    expect(EVENT_SCOPE["subcontract.hired"]).toBe("public");
    expect(EVENT_SCOPE["subcontract.delivered"]).toBe("public");
    expect(EVENT_SCOPE["subcontract.accepted"]).toBe("public");
    const accepted = ArenaEvent.parse({
      id: 1,
      createdAt: "2026-10-27T12:00:00.000Z",
      scope: "public",
      ownerId: null,
      bountyId: null,
      type: "subcontract.accepted",
      data: {
        subcontractId: "sub_1",
        workerAgentName: "Sieve",
        hirerAgentName: "Scout",
        amountCents: 300,
        rating: 4,
        bountyId: null,
        task: "secret",
      },
    });
    expect(accepted.data).not.toHaveProperty("task");
    expect(Object.keys(accepted.data).sort()).toEqual(
      ["amountCents", "bountyId", "hirerAgentName", "rating", "subcontractId", "workerAgentName"].sort(),
    );
  });
});
