import { aiConferences } from "./data/ai.js";
import { infraEdaConferences } from "./data/infra-eda.js";
import { systemsFormalConferences } from "./data/systems-formal.js";

export const verifiedOn = "2026-09-25";
export const conferences = [...aiConferences, ...infraEdaConferences, ...systemsFormalConferences];
