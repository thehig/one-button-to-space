import { SourceTreeNode } from "./types";

// Define constants for the default parent node
const UNCATEGORIZED_ID = "Uncategorized";
const UNCATEGORIZED_SYMBOL = "📂";

const DEBUG = false;

export class GameEventLogConfig {
  private sourceTree: SourceTreeNode[];
  private symbolMap: Record<string, string>;
  // Simple pool of fallback symbols for dynamic sources
  private fallbackSymbols = [
    // Original
    "❓",
    "❔",
    "🔹",
    "🔸",
    "▫️",
    "▪️",
    // Added Set 1 (Shapes/Geometric)
    "🔺",
    "🔻",
    "⚫",
    "⚪",
    "🟥",
    "🟦",
    "🟩",
    "🟨",
    "🟧",
    "🟪",
    "🔶",
    "🔷",
    "🔸",
    "🔹",
    "🔘",
    "✔️",
    "✖️",
    "➕",
    "➖",
    "➗",
    // Added Set 2 (Simple Icons/Misc)
    "💡",
    "🔔",
    "🔑",
    "🔒",
    "⚙️",
    "🔗",
    "🔧",
    "📍",
    "📌",
    "✏️",
    "🔍",
    "📈",
    "📉",
    "📊",
    "🎯",
    "🏁",
    "🚩",
    "⚠️",
    "❗",
    "❔",
  ];
  private fallbackSymbolIndex = 0;

  constructor(sourceTreeData?: SourceTreeNode[]) {
    // Handle undefined input gracefully
    const initialData = sourceTreeData || [];
    this.sourceTree = this.structureInitialTree(initialData);
    this.symbolMap = this.buildSymbolMap(this.sourceTree);
    this.fallbackSymbolIndex = 0;
  }

  /**
   * Structures the initial tree data, placing uncategorized nodes under a default parent.
   * @param nodes The initial SourceTreeNode array.
   * @returns The structured SourceTreeNode array.
   */
  private structureInitialTree(nodes: SourceTreeNode[]): SourceTreeNode[] {
    const structuredTree: SourceTreeNode[] = [];
    let uncategorizedParent: SourceTreeNode | null = null;

    nodes.forEach((node) => {
      // If a node has children, it's considered a predefined category/parent, keep it at top level
      if (node.children && node.children.length > 0) {
        structuredTree.push(node);
      } else {
        // Node is a potential individual source (no children or empty children array)
        // Place it under the "Uncategorized" parent
        if (!uncategorizedParent) {
          // Create the "Uncategorized" parent if it doesn't exist yet
          uncategorizedParent = {
            id: UNCATEGORIZED_ID,
            symbol: UNCATEGORIZED_SYMBOL,
            children: [],
          };
          structuredTree.push(uncategorizedParent);
        }
        // Add the node as a child, ensuring it has an id and symbol
        if (node.id && node.symbol) {
          // Check parent is not null before pushing
          if (uncategorizedParent?.children) {
            uncategorizedParent.children.push(node);
          }
        } else if (node.id) {
          // If symbol is missing, assign a fallback (though buildSymbolMap handles the map)
          node.symbol = this.getNextFallbackSymbol();
          // Check parent is not null before pushing
          if (uncategorizedParent?.children) {
            uncategorizedParent.children.push(node);
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          DEBUG &&
            console.warn(
              `Node ${node.id} provided without symbol, assigned fallback.`
            );
        }
      }
    });

    // Ensure the Uncategorized parent node itself is added if it was created but received no children
    // (This case shouldn't happen often with the current logic, but safeguards)
    if (
      uncategorizedParent &&
      !structuredTree.some((n) => n.id === UNCATEGORIZED_ID)
    ) {
      structuredTree.push(uncategorizedParent);
    }

    return structuredTree;
  }

  /**
   * Recursively builds a map from source ID to symbol from the tree.
   * @param nodes The tree nodes to traverse.
   * @returns A record mapping source IDs to symbols.
   */
  private buildSymbolMap(nodes: SourceTreeNode[]): Record<string, string> {
    const map: Record<string, string> = {};
    const traverse = (nodeList: SourceTreeNode[]) => {
      nodeList.forEach((node) => {
        // Only map nodes that have both an id and a symbol defined explicitly
        if (node.id && node.symbol) {
          map[node.id] = node.symbol;
        }
        // Recurse into children
        if (node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(nodes);
    return map;
  }

  /**
   * Finds the next available fallback symbol from the pool.
   * Cycles back to the beginning if the pool is exhausted.
   * @returns A fallback symbol string.
   */
  private getNextFallbackSymbol(): string {
    const symbol = this.fallbackSymbols[this.fallbackSymbolIndex];
    this.fallbackSymbolIndex =
      (this.fallbackSymbolIndex + 1) % this.fallbackSymbols.length;
    return symbol;
  }

  /**
   * Ensures a source exists in the configuration. If not, adds it dynamically.
   * @param sourceId The ID of the source to ensure.
   * @returns `true` if the source was newly added, `false` otherwise.
   */
  public ensureSourceExists(sourceId: string): boolean {
    // Check the symbol map first, as it contains all known source IDs
    if (this.symbolMap[sourceId]) {
      return false; // Already exists
    }

    // Source doesn't exist, add it dynamically
    const symbol = this.getNextFallbackSymbol();
    this.symbolMap[sourceId] = symbol; // Add to map immediately

    // Find or create the "Uncategorized" parent node in the tree
    let parentNode = this.findNodeById(this.sourceTree, UNCATEGORIZED_ID);

    if (!parentNode) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      DEBUG && console.log("Creating Uncategorized parent node dynamically.");
      parentNode = {
        id: UNCATEGORIZED_ID,
        symbol: UNCATEGORIZED_SYMBOL,
        children: [],
      };
      this.sourceTree.push(parentNode);
      // Also add the parent to the symbol map if it wasn't there
      if (!this.symbolMap[UNCATEGORIZED_ID]) {
        this.symbolMap[UNCATEGORIZED_ID] = UNCATEGORIZED_SYMBOL;
      }
    }

    // Ensure parent has a children array
    // Add null check for parentNode
    if (parentNode && !parentNode.children) {
      parentNode.children = [];
    }

    // Create the new node for the source
    const newNode: SourceTreeNode = { id: sourceId, symbol: symbol };

    // Add the new source node as a child of the Uncategorized parent
    // Avoid duplicates within children array if ensureSourceExists is somehow called twice quickly
    // Add null check for parentNode
    if (
      parentNode &&
      parentNode.children &&
      !parentNode.children.some((child) => child.id === sourceId)
    ) {
      parentNode.children.push(newNode);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      DEBUG &&
        console.log(
          `Dynamically added source: ${sourceId} (${symbol}) under ${UNCATEGORIZED_ID}`
        );
    } else if (parentNode) {
      // Add null check
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      DEBUG &&
        console.warn(
          `Attempted to dynamically re-add source: ${sourceId} under ${UNCATEGORIZED_ID}`
        );
    } else {
      // This case should ideally not happen if logic above is correct
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      DEBUG &&
        console.error(
          `Could not find or create parent node ${UNCATEGORIZED_ID} for dynamic source ${sourceId}`
        );
    }

    return true; // Indicate that the config logic potentially updated the tree/map
  }

  /**
   * Recursively finds a node by its ID within a given tree structure.
   * @param nodes The tree nodes to search.
   * @param id The ID of the node to find.
   * @returns The found SourceTreeNode or null.
   */
  private findNodeById(
    nodes: SourceTreeNode[],
    id: string
  ): SourceTreeNode | null {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.children) {
        const foundInChildren = this.findNodeById(node.children, id);
        if (foundInChildren) {
          return foundInChildren;
        }
      }
    }
    return null;
  }

  /**
   * Adds a single source with its symbol, optionally under a parent.
   * If parentId is provided but not found, adds to the top level.
   * @param sourceId The unique ID for the source.
   * @param symbol The emoji symbol for the source.
   * @param parentId Optional ID of the parent node.
   */
  public addSource(sourceId: string, symbol: string, parentId?: string): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    DEBUG &&
      console.warn(
        "addSource is deprecated for dynamic use. Use constructor or ensureSourceExists."
      );
    // Basic implementation remains, but ensure it interacts correctly with ensureSourceExists logic if used.
    if (!this.symbolMap[sourceId]) {
      this.symbolMap[sourceId] = symbol;
    } else {
      // If ensureSourceExists already added it with a fallback, update the symbol
      symbol = this.symbolMap[sourceId]; // Use existing symbol if dynamically added
    }

    const newNode: SourceTreeNode = { id: sourceId, symbol };
    let parentNode: SourceTreeNode | null = null;

    if (parentId) {
      parentNode = this.findNodeById(this.sourceTree, parentId);
    }

    const nodeExists = this.findNodeById(this.sourceTree, sourceId);

    if (!nodeExists) {
      if (parentNode) {
        if (!parentNode.children) {
          parentNode.children = [];
        }
        parentNode.children.push(newNode);
      } else {
        this.sourceTree.push(newNode);
      }
    } else if (nodeExists && !nodeExists.symbol) {
      // Update symbol if node existed without one
      nodeExists.symbol = symbol;
    }
  }

  /**
   * Merges an array of SourceTreeNode objects into the existing tree.
   * DEPRECATED: Provide full tree at construction.
   * @param treeData An array of SourceTreeNode objects to add.
   */
  public addSourceTree(treeData: SourceTreeNode[]): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    DEBUG &&
      console.warn(
        "addSourceTree is deprecated. Provide the full tree structure via the constructor."
      );
    // Simple concat might lead to duplicates; ideally merge logic or disallow post-construction adds.
    // For now, just concat and rebuild map.
    this.sourceTree = this.sourceTree.concat(treeData);
    this.symbolMap = this.buildSymbolMap(this.sourceTree); // Rebuild needed
  }

  /**
   * Gets the internal source tree structure.
   * @returns The array of SourceTreeNode objects.
   */
  public getSourceTree(): SourceTreeNode[] {
    return this.sourceTree;
  }

  /**
   * Gets the symbol for a given source ID.
   * @param sourceId The ID of the source.
   * @returns The corresponding symbol or a fallback '❓'.
   */
  public getSymbol(sourceId: string): string {
    // Let the fallback handle cases where ensureSourceExists hasn't run yet.
    return this.symbolMap[sourceId] || "❓";
  }

  /**
   * Gets all known source IDs present in the symbol map (includes dynamically added
   * and potentially the uncategorized parent ID itself if it was added).
   * Filters out the internal uncategorized parent ID before returning.
   * @returns An array of source ID strings.
   */
  public getAllSourceIds(): string[] {
    // The keys of the symbolMap represent all known source IDs.
    // Filter out the internal parent ID as it's not a real event source.
    return Object.keys(this.symbolMap).filter((id) => id !== UNCATEGORIZED_ID);
  }
}

// --- Removed old standalone functions ---
/*
// Helper to get symbol or fallback
export const getSymbol = (source: string): string =>
  sourceSymbols[source] || "❓"; // Question mark fallback

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
*/
