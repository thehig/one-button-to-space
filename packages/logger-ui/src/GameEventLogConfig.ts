import { SourceTreeNode } from "./types";

export class GameEventLogConfig {
  private sourceTree: SourceTreeNode[];
  private symbolMap: Record<string, string>;

  constructor(sourceTreeData?: SourceTreeNode[]) {
    this.sourceTree = sourceTreeData || [];
    this.symbolMap = this.buildSymbolMap(this.sourceTree);
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
        // Only map nodes that have both an id and a symbol
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
    this.symbolMap[sourceId] = symbol;

    const newNode: SourceTreeNode = { id: sourceId, symbol };
    let parentNode: SourceTreeNode | null = null;

    if (parentId) {
      parentNode = this.findNodeById(this.sourceTree, parentId);
    }

    if (parentNode) {
      if (!parentNode.children) {
        parentNode.children = [];
      }
      if (!parentNode.children.some((child) => child.id === sourceId)) {
        parentNode.children.push(newNode);
      }
    } else {
      if (!this.sourceTree.some((node) => node.id === sourceId)) {
        this.sourceTree.push(newNode);
      }
    }
  }

  /**
   * Merges an array of SourceTreeNode objects into the existing tree.
   * Note: This is a simple concatenation and might lead to duplicate top-level IDs
   * if the same ID exists in both the current tree and the new treeData.
   * Rebuilds the symbol map after merging.
   * @param treeData An array of SourceTreeNode objects to add.
   */
  public addSourceTree(treeData: SourceTreeNode[]): void {
    this.sourceTree = this.sourceTree.concat(treeData);
    this.symbolMap = this.buildSymbolMap(this.sourceTree);
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
    return this.symbolMap[sourceId] || "❓"; // Question mark fallback
  }

  /**
   * Gets all known source IDs that have a symbol defined in the tree.
   * @returns An array of source ID strings.
   */
  public getAllSourceIds(): string[] {
    // The keys of the generated symbolMap represent all valid source IDs.
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
