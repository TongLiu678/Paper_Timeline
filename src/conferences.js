import { aiConferences } from "./data/ai.js";
import { infraEdaConferences } from "./data/infra-eda.js";
import { systemsFormalConferences } from "./data/systems-formal.js";
import { formalEdaExpandedConferences } from "./data/expanded-formal-eda.js";
import { aiExpandedConferences } from "./data/expanded-ai.js";
import { systemsExpandedConferences } from "./data/expanded-systems.js";
import { musicCoreConferences } from "./data/music-core.js";
import { musicAdjacentConferences } from "./data/music-adjacent.js";
import { nlpConferences } from "./data/nlp.js";
import { dslConferences } from "./data/dsl.js";

export const verifiedOn = "2026-10-12";
export const conferences = [
  ...aiConferences,
  ...nlpConferences,
  ...infraEdaConferences,
  ...systemsFormalConferences,
  ...aiExpandedConferences,
  ...systemsExpandedConferences,
  ...formalEdaExpandedConferences,
  ...dslConferences,
  ...musicCoreConferences,
  ...musicAdjacentConferences,
];
