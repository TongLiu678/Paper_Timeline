import { aiConferences } from "./data/ai.js";
import { infraEdaConferences } from "./data/infra-eda.js";
import { systemsFormalConferences } from "./data/systems-formal.js";
import { formalEdaExpandedConferences } from "./data/expanded-formal-eda.js";
import { aiExpandedConferences } from "./data/expanded-ai.js";
import { systemsExpandedConferences } from "./data/expanded-systems.js";
import { musicCoreConferences } from "./data/music-core.js";
import { musicAdjacentConferences } from "./data/music-adjacent.js";

export const verifiedOn = "2026-09-25";
export const conferences = [
  ...aiConferences,
  ...infraEdaConferences,
  ...systemsFormalConferences,
  ...aiExpandedConferences,
  ...systemsExpandedConferences,
  ...formalEdaExpandedConferences,
  ...musicCoreConferences,
  ...musicAdjacentConferences,
];
