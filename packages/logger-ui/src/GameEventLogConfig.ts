import { SourceTreeNode } from "./types";

export class GameEventLogConfig {
  private sourceTree: SourceTreeNode[];
  private symbolMap: Record<string, string>;
  // Simple pool of fallback symbols for dynamic sources
  private fallbackSymbols = ["❓", "❔", "🔹", "🔸", "▫️", "▪️"];
  private fallbackSymbolIndex = 0;

  constructor(sourceTreeData?: SourceTreeNode[]) {
    // Handle undefined input gracefully
    this.sourceTree = sourceTreeData || [];
    this.symbolMap = this.buildSymbolMap(this.sourceTree);
    // Reset index in case of re-instantiation if needed, though unlikely with useState
    this.fallbackSymbolIndex = 0;
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
    if (this.symbolMap[sourceId]) {
      return false; // Already exists
    }

    // Source doesn't exist, add it dynamically
    const symbol = this.getNextFallbackSymbol();
    this.symbolMap[sourceId] = symbol;

    const newNode: SourceTreeNode = { id: sourceId, symbol: symbol };

    // Check if a node with this ID already exists at the top level
    // (could happen if added dynamically before config was provided)
    if (!this.sourceTree.some((node) => node.id === sourceId)) {
      this.sourceTree.push(newNode);
    } else {
      // If node exists but wasn't in symbol map (e.g., no symbol defined initially), update its symbol
      const existingNode = this.findNodeById(this.sourceTree, sourceId);
      if (existingNode && !existingNode.symbol) {
        existingNode.symbol = symbol;
      }
    }

    console.log(`Dynamically added source: ${sourceId} (${symbol})`);
    return true; // Indicate that the config was updated
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
    // Ensure source exists before getting symbol, guaranteeing a symbol is assigned
    // this.ensureSourceExists(sourceId); // Avoid calling this here - causes potential infinite loops/side effects during render. Get should be read-only.
    // Let the fallback handle cases where ensureSourceExists hasn't run yet.
    return this.symbolMap[sourceId] || "❓";
  }

  /**
   * Gets all known source IDs present in the symbol map (includes dynamically added).
   * @returns An array of source ID strings.
   */
  public getAllSourceIds(): string[] {
    // The keys of the symbolMap represent all known source IDs.
    return Object.keys(this.symbolMap);
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
