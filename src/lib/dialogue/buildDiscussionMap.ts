import {
  discussionMapSchema,
  type DiscussionMap,
  type DiscussionNode,
} from "@/lib/schemas/graph";
import type { DialoguePoint, DialogueState } from "@/lib/schemas/dialogue";

function kindForPoint(point: DialoguePoint): DiscussionNode["kind"] {
  if (point.status === "active") return "active_point";
  if (point.status === "resolved") return "resolved_point";
  if (point.status === "open" && point.kind === "question") return "open_question";

  switch (point.kind) {
    case "concept":
      return "concept";
    case "misconception":
      return "misconception";
    case "viewpoint":
      return "viewpoint";
    case "summary":
      return "summary";
    case "claim":
      return point.status === "open" ? "open_question" : "active_point";
    case "question":
      return "open_question";
  }
}

export function buildDiscussionMap(state: DialogueState): DiscussionMap {
  const mainId = "discussion-main";

  const nodes: DiscussionMap["nodes"] = [];
  if (state.mainTopic) {
    nodes.push({
      id: mainId,
      label: state.mainTopic,
      kind: "main_question",
      status: state.points.length ? undefined : "active",
      evidenceIds: state.evidenceUsed,
    });
  }

  for (const point of state.points) {
    nodes.push({
      id: point.id,
      label: point.label,
      kind: kindForPoint(point),
      status: point.status,
      evidenceIds: [],
    });
  }

  const knownIds = new Set(nodes.map((node) => node.id));
  const edges: DiscussionMap["edges"] = state.points
    .map((point, index) => {
      const source =
        point.parentId && knownIds.has(point.parentId)
          ? point.parentId
          : state.mainTopic
            ? mainId
            : null;

      if (!source) return null;

      const relation: DiscussionMap["edges"][number]["relation"] =
        point.status === "resolved"
          ? "RESOLVES"
          : point.kind === "viewpoint" || point.kind === "misconception"
            ? "CONTRASTS"
            : point.parentId
              ? "EXPANDS"
              : "LEADS_TO";

      return {
        id: `discussion-edge-${index + 1}`,
        source,
        target: point.id,
        relation,
      };
    })
    .filter((edge): edge is NonNullable<typeof edge> => edge !== null);

  return discussionMapSchema.parse({ nodes, edges });
}
