// Import matchers from jest-dom
import "@testing-library/jest-dom/vitest";

// Import global mocks
// These files contain vi.mock calls or other global setups (like spies)
// which will be hoisted and applied globally.
import "./mocks/phaser";
import "./mocks/CommunicationManager";
import "./mocks/console";

// No other setup needed here now
