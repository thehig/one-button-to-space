export const SHARED_TEST_CONSTANT = "Hello from Shared Package!";

export const testSharedFunction = (): string => {
  return "Function call from shared package successful!";
};

export * from "./physics/PhysicsEngine";
export * from "./constants/collisionCategories";
export * from "./constants/eventNames";
export * from "./constants/sceneKeys";
export * from "./constants/assetKeys";
export * from "./types/entities";
export * from "./types/inputs";
export * from "./types/network";
export * from "./types/missions";
