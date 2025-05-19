import React from "react";
// Example import to verify monorepo linkage
// Remove or replace with real usage later
import { PhysicsEngine } from "@obts/shared/physics/PhysicsEngine";

const Visualizer: React.FC = () => {
  // Just to verify import works
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(
      "PhysicsEngine from @obts/shared:",
      PhysicsEngine ? "OK" : "NOT FOUND"
    );
  }, []);

  return (
    <div>
      {/* Visualizer UI will be composed here */}
      <h1>Physics Visualizer (React)</h1>
    </div>
  );
};

export default Visualizer;
