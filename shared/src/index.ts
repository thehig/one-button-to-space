// Placeholder for shared library entry point
console.log("Shared package loaded");

export const sharedValue = 42;

// Export physics components
export * from "./physics/PhysicsEngine";
export * from "./physics/constants";

// export {}; // No longer needed as we have exports
