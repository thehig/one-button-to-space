export interface SourceTreeNode {
  id: string; // Unique identifier (usually the source name)
  label: string; // Display name (usually the source name)
  symbol?: string; // Emoji/Symbol
  children?: SourceTreeNode[];
}

export const sourceSymbols: Record<string, string> = {
  LifecycleManager: "⚙️", // Gear
  PhysicsManager: "🏈", // Football (Matter.js shape) / Could use ന്യ or other physics symbol
  EntityManager: "🧍", // Person Standing
  InputManager: "🖱️", // Mouse
  NetworkManager: "🌐", // Globe with Meridians
  CameraManager: "📷", // Camera
  UIManager: "📊", // Bar Chart
  AudioManager: "🔊", // Speaker High Volume
  CommunicationManager: "💬", // Speech Bubble
  BootScene: "🚀", // Rocket
  MainMenuScene: "🏠", // House
  GameScene: "🎮", // Video Game
  Scene: "🎬", // Clapper Board (Generic scene events)
  // Add more as needed
};

// Helper to get symbol or fallback
export const getSymbol = (source: string): string =>
  sourceSymbols[source] || "❓"; // Question mark fallback

export const sourceTreeData: SourceTreeNode[] = [
  // Moved CommunicationManager and LifecycleManager under Managers
  // { id: "CommunicationManager", label: "CommunicationManager", symbol: getSymbol("CommunicationManager") },
  {
    id: "Scenes",
    label: "Scenes",
    symbol: "🎬", // Use Scene symbol for the group
    children: [
      { id: "BootScene", label: "BootScene", symbol: getSymbol("BootScene") },
      {
        id: "MainMenuScene",
        label: "MainMenuScene",
        symbol: getSymbol("MainMenuScene"),
      },
      { id: "GameScene", label: "GameScene", symbol: getSymbol("GameScene") },
      { id: "Scene", label: "Scene", symbol: getSymbol("Scene") }, // Generic
    ],
  },
  // { id: "LifecycleManager", label: "LifecycleManager", symbol: getSymbol("LifecycleManager") },
  {
    id: "Managers",
    label: "Managers",
    symbol: "🛠️", // Hammer and Wrench for the group
    children: [
      // Added LifecycleManager and CommunicationManager here
      {
        id: "LifecycleManager",
        label: "LifecycleManager",
        symbol: getSymbol("LifecycleManager"),
      },
      {
        id: "CommunicationManager",
        label: "CommunicationManager",
        symbol: getSymbol("CommunicationManager"),
      },
      {
        id: "PhysicsManager",
        label: "PhysicsManager",
        symbol: getSymbol("PhysicsManager"),
      },
      {
        id: "EntityManager",
        label: "EntityManager",
        symbol: getSymbol("EntityManager"),
      },
      {
        id: "InputManager",
        label: "InputManager",
        symbol: getSymbol("InputManager"),
      },
      {
        id: "NetworkManager",
        label: "NetworkManager",
        symbol: getSymbol("NetworkManager"),
      },
      {
        id: "CameraManager",
        label: "CameraManager",
        symbol: getSymbol("CameraManager"),
      },
      { id: "UIManager", label: "UIManager", symbol: getSymbol("UIManager") },
      {
        id: "AudioManager",
        label: "AudioManager",
        symbol: getSymbol("AudioManager"),
      },
    ],
  },
];

// Function to get all source IDs from the tree (including children)
export const getAllSourceIds = (nodes: SourceTreeNode[]): string[] => {
  let ids: string[] = [];
  nodes.forEach((node) => {
    // Only add leaf nodes or nodes without children explicitly defined in treeData
    // Parent nodes like "Scenes", "Managers" are not real sources themselves
    if (!node.children || node.children.length === 0) {
      if (sourceSymbols[node.id]) {
        // Only add if it's a known source type
        ids.push(node.id);
      }
    }
    if (node.children) {
      ids = ids.concat(getAllSourceIds(node.children));
    }
  });
  return ids;
};
