// Default keybindings for desktop
// Format: { action: [key_code_1, key_code_2, ...] }

export const desktopKeybindings = {
  thrust: ["W", "UP"],
  turnLeft: ["A", "LEFT"],
  turnRight: ["D", "RIGHT"],
  menu: ["ESC", "P"], // Added P as an alternative
};

// Define a type for better type checking
export type DesktopKeybindings = typeof desktopKeybindings;
export type DesktopAction = keyof DesktopKeybindings;
