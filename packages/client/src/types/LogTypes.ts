import { SourceTreeNode } from "@one-button-to-space/logger-ui";

export const sourceTreeData: SourceTreeNode[] = [
  // Moved CommunicationManager and LifecycleManager under Managers
  // { id: "CommunicationManager", symbol: "💬" },
  {
    id: "Scenes",
    symbol: "🎬", // Use Scene symbol for the group
    children: [
      { id: "BootScene", symbol: "🚀" },
      {
        id: "MainMenuScene",
        symbol: "🏠",
      },
      { id: "GameScene", symbol: "🎮" },
      { id: "Scene", symbol: "🎬" }, // Generic
    ],
  },
  // { id: "LifecycleManager", symbol: "⚙️" },
  {
    id: "Managers",
    symbol: "🛠️", // Hammer and Wrench for the group
    children: [
      // Added LifecycleManager and CommunicationManager here
      {
        id: "LifecycleManager",
        symbol: "⚙️",
      },
      {
        id: "CommunicationManager",
        symbol: "💬",
      },
      {
        id: "PhysicsManager",
        symbol: "🏈",
      },
      {
        id: "EntityManager",
        symbol: "🧍",
      },
      {
        id: "InputManager",
        symbol: "🖱️",
      },
      {
        id: "NetworkManager",
        symbol: "🌐",
      },
      {
        id: "CameraManager",
        symbol: "📷",
      },
      { id: "UIManager", symbol: "📊" },
      {
        id: "AudioManager",
        symbol: "🔊",
      },
    ],
  },
];
