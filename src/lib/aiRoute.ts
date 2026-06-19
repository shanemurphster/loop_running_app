import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { POSITIVE_TAGS } from "./tags";
import type { RouteCluster } from "./discovery";

// Model: Haiku — cheapest tier, per project direction. This is the ONLY paid
// call in the discovery pipeline, and it runs once per newly-promoted route.
export const CLAUDE_MODEL = "claude-haiku-4-5";

const POSITIVE_TAG_IDS = POSITIVE_TAGS.map((t) => t.id);

// We force a single tool call to get structured, schema-shaped output — the
// most portable approach across SDK versions. Zod re-validates the result.
const RouteMetaSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  predictedTags: z.array(z.enum(POSITIVE_TAG_IDS as [string, ...string[]])),
});

export type RouteMeta = z.infer<typeof RouteMetaSchema>;

const TOOL: Anthropic.Tool = {
  name: "save_route",
  description: "Save the name, description, and predicted tags for a discovered route.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "A short, real-sounding route name a local runner would use.",
      },
      description: {
        type: "string",
        description: "One or two grounded sentences on what the run is like.",
      },
      predictedTags: {
        type: "array",
        items: { type: "string", enum: POSITIVE_TAG_IDS },
        description: "Tags you predict apply, chosen only from the allowed values.",
      },
    },
    required: ["name", "description", "predictedTags"],
    additionalProperties: false,
  },
};

const SYSTEM = `You name and describe running routes that Loop discovered from real runners' GPS data — paths that many people independently chose to run in the same place. Write like a knowledgeable local, not a marketer. Names are concise and specific (e.g. "Pennypack Creek Path", "Virginia Key Trails"), never generic ("Great Run 1"). Descriptions are 1–2 grounded sentences. Only predict tags you can reasonably infer from the facts given; predicting none is fine.`;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    // .trim() guards against a stray leading/trailing space in the env value.
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

/** One Haiku call → name, description, and predicted tags for a cluster. */
export async function nameCluster(cluster: RouteCluster): Promise<RouteMeta> {
  const tagList = POSITIVE_TAGS.map((t) => `${t.id} (${t.label})`).join(", ");
  const prompt = `A path in ${cluster.city} has been run by ${cluster.runnerCount} distinct runners.
Facts:
- Distance: ${cluster.distanceMi} miles
- Elevation gain: ~${cluster.elevationFt} ft
- Type: ${cluster.routeType}

Available tags: ${tagList}

Call save_route with a name, description, and predicted tags for this route.`;

  const res = await getClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "save_route" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) throw new Error("Model did not return a tool call");

  return RouteMetaSchema.parse(toolUse.input);
}
