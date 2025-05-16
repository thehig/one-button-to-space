export enum ObjectiveType {
  REACH_ALTITUDE = "REACH_ALTITUDE",
  ACHIEVE_ORBIT = "ACHIEVE_ORBIT", // Could be simplified to maintaining altitude for X time above Y speed
  COLLECT_ITEM = "COLLECT_ITEM",
  DELIVER_ITEM = "DELIVER_ITEM",
  LAND_AT_TARGET = "LAND_AT_TARGET",
  AVOID_COLLISION_TIME = "AVOID_COLLISION_TIME", // Survive for X seconds
  REACH_ESCAPE_VELOCITY = "REACH_ESCAPE_VELOCITY",
}

export enum ObjectiveStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface IObjective {
  id: string;
  type: ObjectiveType;
  description: string;
  status: ObjectiveStatus;
  targetValue?: number | string; // e.g., target altitude, item ID to collect
  currentValue?: number | string; // e.g., current altitude
  optional?: boolean;
  rewards?: IReward[]; // Define IReward if needed, e.g., score, currency
  prerequisites?: string[]; // IDs of other objectives that must be completed first
}

export interface IMission {
  id: string;
  title: string;
  description: string;
  objectives: IObjective[];
  status: ObjectiveStatus; // Overall mission status, could be derived from objectives
  briefing: string; // Story/context for the mission
  debriefingSuccess?: string; // Message on successful completion
  debriefingFailure?: string; // Message on failure
  rewards?: IReward[]; // Overall mission rewards
  timeLimitSeconds?: number;
}

// Example for rewards, can be expanded
export interface IReward {
  type: "SCORE" | "CURRENCY" | "ITEM_UNLOCK";
  value?: number;
  itemId?: string;
}
