// packages/shared/src/index.ts

// This file serves as the main entry point for the shared package.
// Export all shared types, constants, utilities, etc., from here.

import * as InputTypes from "./types/InputTypes";
import * as Logger from "./utils/Logger";
import * as Constants from "./physics/Constants";
import * as PhysicsLogic from "./physics/PhysicsLogic";
import * as CollisionCategories from "./physics/CollisionCategories";
import * as Config from "./config/config";

export default {
  InputTypes,
  Logger,
  Constants,
  PhysicsLogic,
  CollisionCategories,
  Config,
};
