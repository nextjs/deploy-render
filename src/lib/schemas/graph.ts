import { z } from "zod";
import { idSchema } from "./common";

export const evidenceGraphNodeSchema = z.object({
  id: idSchema,
  type: z.enum(["claim", "evidence", "source", "view"]),
  label: z.string().min(1),
});

export const evidenceGraphEdgeSchema = z.object({
  id: idSchema,
  from: idSchema,
  to: idSchema,
  type: z.enum([
    "SUPPORTS",
    "QUALIFIES",
    "CONTRADICTS",
    "DEFINES",
    "CITED_FROM",
  ]),
});

export const evidenceGraphSchema = z.object({
  nodes: z.array(evidenceGraphNodeSchema).default([]),
  edges: z.array(evidenceGraphEdgeSchema).default([]),
});

export const discussionNodeSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  kind: z.enum([
    "main_question",
    "active_point",
    "resolved_point",
    "open_question",
    "concept",
    "evidence",
    "misconception",
    "viewpoint",
    "summary",
  ]),
  status: z.enum(["active", "resolved", "open", "disputed"]).optional(),
  evidenceIds: z.array(idSchema).default([]),
});

export const discussionEdgeSchema = z.object({
  id: idSchema,
  source: idSchema,
  target: idSchema,
  relation: z.enum(["LEADS_TO", "SUPPORTS", "EXPANDS", "CONTRASTS", "RESOLVES"]),
});

export const discussionMapSchema = z.object({
  nodes: z.array(discussionNodeSchema).default([]),
  edges: z.array(discussionEdgeSchema).default([]),
});

export type EvidenceGraphNode = z.infer<typeof evidenceGraphNodeSchema>;
export type EvidenceGraphEdge = z.infer<typeof evidenceGraphEdgeSchema>;
export type EvidenceGraph = z.infer<typeof evidenceGraphSchema>;
export type DiscussionNode = z.infer<typeof discussionNodeSchema>;
export type DiscussionEdge = z.infer<typeof discussionEdgeSchema>;
export type DiscussionMap = z.infer<typeof discussionMapSchema>;
