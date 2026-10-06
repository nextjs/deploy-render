import { updateDialogueState } from "../src/lib/dialogue/updateState";
import { buildDiscussionMap } from "../src/lib/dialogue/buildDiscussionMap";
import { buildEvidenceGraph } from "../src/lib/dialogue/buildEvidenceGraph";
import { discussionMapSchema, evidenceGraphSchema } from "../src/lib/schemas/graph";

async function main() {
  console.log("1. Updating first dialogue turn...");
  const first = await updateDialogueState({
    userQuestion: "لماذا تختلف آراء العلماء؟",
    verifiedResponseSummary:
      "قد يقع الخلاف العلمي بسبب اختلاف فهم الدليل أو ثبوته أو طريقة الجمع بين الأدلة.",
    evidenceIdsUsed: ["evidence-1"],
  });

  if (!first.mainTopic || first.points.length === 0) {
    throw new Error("First turn did not create a useful dialogue state.");
  }
  if (first.evidenceUsed.some((id) => id !== "evidence-1")) {
    throw new Error("First turn invented evidence.");
  }

  console.log("2. Updating follow-up turn...");
  const second = await updateDialogueState({
    previousDialogueState: first,
    userQuestion: "هل يعني هذا أن الدين متناقض؟",
    verifiedResponseSummary:
      "وجود الخلاف في فهم بعض المسائل لا يعني بذاته وجود تناقض في أصل الدين.",
    evidenceIdsUsed: ["evidence-1", "evidence-2"],
  });

  console.log("3. Building discussion map...");
  const map = discussionMapSchema.parse(buildDiscussionMap(second));
  if (map.nodes.length === 0) throw new Error("Discussion map is empty.");

  console.log("4. Building deterministic evidence graph...");
  const graph = evidenceGraphSchema.parse(
    buildEvidenceGraph({
      claims: [
        {
          id: "claim-1",
          text: "اختلاف العلماء لا يعني بذاته تناقض أصل الدين.",
          evidenceIds: ["evidence-2"],
          status: "SUPPORTED",
        },
      ],
      evidence: [
        {
          id: "evidence-2",
          chunkId: "chunk-2",
          recordId: "record-2",
          sourceId: "source-2",
          sourceType: "other_approved",
          sourceName: "Approved test source",
          text: "Controlled test evidence for graph wiring.",
          locator: "test:2",
          relation: "SUPPORTS",
          viewId: null,
        },
      ],
      verifications: [
        {
          claimId: "claim-1",
          status: "SUPPORTED",
          reason: "Controlled test verification.",
          evidenceIds: ["evidence-2"],
        },
      ],
    }),
  );

  if (!graph.edges.some((edge) => edge.type === "SUPPORTS")) {
    throw new Error("Evidence graph did not link evidence to claim.");
  }
  if (!graph.edges.some((edge) => edge.type === "CITED_FROM")) {
    throw new Error("Evidence graph did not link evidence to source.");
  }

  console.log("\n✓ Dialogue engine smoke test passed.");
  console.log(JSON.stringify({
    firstTurnPoints: first.points.length,
    secondTurnPoints: second.points.length,
    discussionNodes: map.nodes.length,
    discussionEdges: map.edges.length,
    evidenceGraphNodes: graph.nodes.length,
    evidenceGraphEdges: graph.edges.length,
  }, null, 2));
}

main().catch((error) => {
  console.error("\n✗ Dialogue engine smoke test failed.");
  console.error(error);
  process.exitCode = 1;
});
