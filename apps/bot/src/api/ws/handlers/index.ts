import type { WSHandler } from "@/api/server";
import { connectionHandlers } from "./connection";
import { playerHandlers } from "./player";
import { queueHandlers } from "./queue";
import { filterHandlers } from "./filter";
import { historyHandlers } from "./history";

// Re-export utilities for external use
export * from "./utils";
export * from "./filters";

// Compose all handlers
export function createWSHandlers(): Record<string, WSHandler> {
  return {
    ...connectionHandlers,
    ...playerHandlers,
    ...queueHandlers,
    ...filterHandlers,
    ...historyHandlers,
  };
}
