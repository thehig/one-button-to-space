// packages/logger-ui/src/index.ts
export { CommunicationManager } from "./managers/CommunicationManager";
export {
  CommunicationProvider,
  useCommunicationContext,
} from "./contexts/CommunicationContext";
export { GameEventLog } from "./components/GameEventLog";
export type { EventLogEntry } from "./types"; // Assuming EventLogEntry is in types.ts
