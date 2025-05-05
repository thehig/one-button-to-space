import { describe, it, expect } from "vitest";
import { GameEventLogConfig } from "./GameEventLogConfig";
import type { SourceTreeNode } from "./types";

// Constants for default node
const UNCATEGORIZED_ID = "Uncategorized";
const UNCATEGORIZED_SYMBOL = "📂";

// Define some sample input data
const flatNodes: SourceTreeNode[] = [
  { id: "SourceA", symbol: "🅰️" },
  { id: "SourceB", symbol: "🅱️" },
];

const nestedNodes: SourceTreeNode[] = [
  {
    id: "Category1",
    symbol: "🥇",
    children: [
      { id: "SourceC", symbol: " C " },
      { id: "SourceD", symbol: " D " },
    ],
  },
  {
    id: "Category2",
    symbol: "🥈",
    children: [{ id: "SourceE", symbol: " E " }],
  },
  { id: "SourceF", symbol: " F " }, // Flat node mixed with nested
];

const nodesWithMissingSymbols: SourceTreeNode[] = [
  { id: "SourceG", symbol: " G " },
  { id: "SourceH" }, // Missing symbol
  { id: "SourceI", symbol: " I " },
];

const fallbackSymbols = [
  "❓",
  "❔",
  "🔹",
  "🔸",
  "▫️",
  "▪️",
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

describe("GameEventLogConfig", () => {
  describe("Constructor and getSourceTree", () => {
    it('should initialize with a default "Uncategorized" node if no data provided', () => {
      const config = new GameEventLogConfig();
      const tree = config.getSourceTree();

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(UNCATEGORIZED_ID);
      expect(tree[0].symbol).toBe(UNCATEGORIZED_SYMBOL);
      expect(tree[0].children).toEqual([]);
    });

    it('should group flat nodes under the "Uncategorized" parent', () => {
      const config = new GameEventLogConfig(flatNodes);
      const tree = config.getSourceTree();

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(UNCATEGORIZED_ID);
      expect(tree[0].symbol).toBe(UNCATEGORIZED_SYMBOL);
      expect(tree[0].children).toHaveLength(flatNodes.length);
      expect(tree[0].children).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "SourceA", symbol: "🅰️" }),
          expect.objectContaining({ id: "SourceB", symbol: "🅱️" }),
        ])
      );
    });

    it("should preserve nested structure and group flat nodes", () => {
      const config = new GameEventLogConfig(nestedNodes);
      const tree = config.getSourceTree();

      // Expected: Category1, Category2, Uncategorized (for SourceF)
      expect(tree).toHaveLength(3);

      // Check Category1
      const cat1 = tree.find((n) => n.id === "Category1");
      expect(cat1).toBeDefined();
      expect(cat1?.symbol).toBe("🥇");
      expect(cat1?.children).toHaveLength(2);
      expect(cat1?.children).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "SourceC", symbol: " C " }),
          expect.objectContaining({ id: "SourceD", symbol: " D " }),
        ])
      );

      // Check Category2
      const cat2 = tree.find((n) => n.id === "Category2");
      expect(cat2).toBeDefined();
      expect(cat2?.symbol).toBe("🥈");
      expect(cat2?.children).toHaveLength(1);
      expect(cat2?.children?.[0]).toEqual(
        expect.objectContaining({ id: "SourceE", symbol: " E " })
      );

      // Check Uncategorized (for SourceF)
      const uncategorized = tree.find((n) => n.id === UNCATEGORIZED_ID);
      expect(uncategorized).toBeDefined();
      expect(uncategorized?.symbol).toBe(UNCATEGORIZED_SYMBOL);
      expect(uncategorized?.children).toHaveLength(1);
      expect(uncategorized?.children?.[0]).toEqual(
        expect.objectContaining({ id: "SourceF", symbol: " F " })
      );
    });

    it("should assign fallback symbols to nodes missing them and group under Uncategorized", () => {
      const config = new GameEventLogConfig(nodesWithMissingSymbols);
      const tree = config.getSourceTree();

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(UNCATEGORIZED_ID);
      expect(tree[0].children).toHaveLength(nodesWithMissingSymbols.length);

      const sourceG = tree[0].children?.find((n) => n.id === "SourceG");
      const sourceH = tree[0].children?.find((n) => n.id === "SourceH");
      const sourceI = tree[0].children?.find((n) => n.id === "SourceI");

      expect(sourceG?.symbol).toBe(" G ");
      expect(sourceH?.symbol).toBe(fallbackSymbols[0]); // First fallback symbol
      expect(sourceI?.symbol).toBe(" I ");
    });

    it("should handle empty initial data gracefully", () => {
      const config = new GameEventLogConfig([]);
      const tree = config.getSourceTree();
      // Should behave same as undefined -> default Uncategorized node
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(UNCATEGORIZED_ID);
    });
  });

  describe("ensureSourceExists", () => {
    let config: GameEventLogConfig;
    const dynamicSource1 = "DynamicSource1";
    const dynamicSource2 = "DynamicSource2";
    const predefinedSource = "SourceA"; // From flatNodes

    beforeEach(() => {
      // Start with a config that has some predefined nodes
      config = new GameEventLogConfig(flatNodes);
    });

    it("should return false if the source already exists (predefined)", () => {
      const result = config.ensureSourceExists(predefinedSource);
      expect(result).toBe(false);
      // Verify tree wasn't significantly changed (check length, maybe snapshot if complex)
      expect(config.getSourceTree()).toHaveLength(1); // Still just Uncategorized parent
      expect(config.getSourceTree()[0].children).toHaveLength(flatNodes.length);
    });

    it("should return true and add a new source under Uncategorized if it does not exist", () => {
      const result = config.ensureSourceExists(dynamicSource1);
      expect(result).toBe(true);

      const tree = config.getSourceTree();
      const uncategorized = tree.find((n) => n.id === UNCATEGORIZED_ID);
      expect(uncategorized).toBeDefined();
      // Expected children: SourceA, SourceB, DynamicSource1
      expect(uncategorized?.children).toHaveLength(flatNodes.length + 1);

      const newNode = uncategorized?.children?.find(
        (n) => n.id === dynamicSource1
      );
      expect(newNode).toBeDefined();
      expect(newNode?.symbol).toBe(fallbackSymbols[0]); // Should get the first fallback
    });

    it("should assign subsequent fallback symbols to new dynamic sources", () => {
      config.ensureSourceExists(dynamicSource1);
      const result2 = config.ensureSourceExists(dynamicSource2);
      expect(result2).toBe(true);

      const tree = config.getSourceTree();
      const uncategorized = tree.find((n) => n.id === UNCATEGORIZED_ID);
      const node1 = uncategorized?.children?.find(
        (n) => n.id === dynamicSource1
      );
      const node2 = uncategorized?.children?.find(
        (n) => n.id === dynamicSource2
      );

      expect(node1?.symbol).toBe(fallbackSymbols[0]);
      expect(node2?.symbol).toBe(fallbackSymbols[1]); // Should get the second fallback
    });

    it("should return false if the source was already dynamically added", () => {
      config.ensureSourceExists(dynamicSource1); // Add it first
      const result = config.ensureSourceExists(dynamicSource1); // Try adding again
      expect(result).toBe(false);

      const tree = config.getSourceTree();
      const uncategorized = tree.find((n) => n.id === UNCATEGORIZED_ID);
      // Length should still be flatNodes + 1
      expect(uncategorized?.children).toHaveLength(flatNodes.length + 1);
    });

    it("should create the Uncategorized parent if the initial tree was empty", () => {
      const emptyConfig = new GameEventLogConfig(); // Starts with default Uncategorized
      // Manually empty the tree and map to simulate a state where it might be missing
      type ConfigInternals = {
        sourceTree: SourceTreeNode[];
        symbolMap: Record<string, string>;
      };
      const internalConfig = emptyConfig as unknown as ConfigInternals;
      internalConfig.sourceTree = [];
      internalConfig.symbolMap = {}; // Clear map too

      const result = emptyConfig.ensureSourceExists(dynamicSource1);
      expect(result).toBe(true);

      const tree = emptyConfig.getSourceTree();
      expect(tree).toHaveLength(1); // Uncategorized should be recreated
      expect(tree[0].id).toBe(UNCATEGORIZED_ID);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children?.[0].id).toBe(dynamicSource1);
    });
  });

  describe("getSymbol", () => {
    let config: GameEventLogConfig;
    const predefinedSource = "SourceA"; // From flatNodes
    const predefinedSymbol = "🅰️";
    const dynamicSource = "DynamicSource3";
    const unknownSource = "UnknownSource";

    beforeEach(() => {
      config = new GameEventLogConfig(flatNodes);
      // Ensure one dynamic source exists for testing
      config.ensureSourceExists(dynamicSource);
    });

    it("should return the correct symbol for a predefined source", () => {
      expect(config.getSymbol(predefinedSource)).toBe(predefinedSymbol);
    });

    it("should return the fallback symbol for a dynamically added source", () => {
      // DynamicSource3 was the second dynamic source added overall (after H in prev tests)
      // but ensureSourceExists resets the fallback index, so it gets the first one here.
      expect(config.getSymbol(dynamicSource)).toBe(fallbackSymbols[0]);
    });

    it("should add a new source via ensureSourceExists and then getSymbol should return its fallback symbol", () => {
      // 1. Explicitly add the unknown source
      const added = config.ensureSourceExists(unknownSource);
      expect(added).toBe(true);

      // 2. Verify it got the expected *next* fallback symbol (index 1, which is '❔')
      const expectedSymbol = fallbackSymbols[1];
      const tree = config.getSourceTree();
      const uncategorized = tree.find((n) => n.id === UNCATEGORIZED_ID);
      const newNode = uncategorized?.children?.find(
        (n) => n.id === unknownSource
      );
      expect(newNode?.symbol).toBe(expectedSymbol);

      // 3. Now getSymbol should return the symbol that was just added
      const symbolFromGet = config.getSymbol(unknownSource);
      expect(symbolFromGet).toBe(expectedSymbol);
    });

    it("should return the default fallback symbol (?) if the source is truly unknown and never added", () => {
      // Directly call getSymbol without ensuring existence first
      expect(config.getSymbol(unknownSource)).toBe("❓");
    });

    // Renamed the previous edge case test for clarity
    it("should return the default fallback symbol (?) even if ensureSourceExists was mocked to fail", () => {
      // Simulate ensureSourceExists failing to add to the map
      type ConfigWithPrivateEnsure = {
        ensureSourceExists: (id: string) => boolean;
      };
      vi.spyOn(
        config as unknown as ConfigWithPrivateEnsure,
        "ensureSourceExists"
      ).mockReturnValueOnce(false);

      // Manually remove from map if it exists to ensure lookup fails
      type ConfigWithSymbolMap = { symbolMap: Record<string, string> };
      delete (config as unknown as ConfigWithSymbolMap).symbolMap[
        unknownSource
      ];

      expect(config.getSymbol(unknownSource)).toBe("❓"); // Default fallback in getSymbol itself
    });
  });

  describe("getAllSourceIds", () => {
    it("should return an empty array for an empty initial config", () => {
      // Constructor creates Uncategorized, but it should be filtered out
      const config = new GameEventLogConfig();
      expect(config.getAllSourceIds()).toEqual([]);
    });

    it("should return IDs from flat initial nodes", () => {
      const config = new GameEventLogConfig(flatNodes);
      // Expect only SourceA and SourceB, Uncategorized is filtered
      expect(config.getAllSourceIds()).toEqual(
        expect.arrayContaining(["SourceA", "SourceB"])
      );
      expect(config.getAllSourceIds()).toHaveLength(2);
    });

    it("should return IDs from nested initial nodes, excluding parent category IDs", () => {
      const config = new GameEventLogConfig(nestedNodes);
      const expectedIds = [
        "Category1",
        "SourceC",
        "SourceD",
        "Category2",
        "SourceE",
        "SourceF",
      ];
      // Expect ALL nodes with symbols, including parents
      expect(config.getAllSourceIds()).toEqual(
        expect.arrayContaining(expectedIds)
      );
      expect(config.getAllSourceIds()).toHaveLength(expectedIds.length);
    });

    it("should include dynamically added source IDs", () => {
      const config = new GameEventLogConfig(flatNodes);
      const dynamicSource1 = "Dynamic1";
      const dynamicSource2 = "Dynamic2";
      config.ensureSourceExists(dynamicSource1);
      config.ensureSourceExists(dynamicSource2);

      // Expect SourceA, SourceB, Dynamic1, Dynamic2
      expect(config.getAllSourceIds()).toEqual(
        expect.arrayContaining([
          "SourceA",
          "SourceB",
          dynamicSource1,
          dynamicSource2,
        ])
      );
      expect(config.getAllSourceIds()).toHaveLength(4);
    });

    it("should handle nodes with missing symbols correctly", () => {
      const config = new GameEventLogConfig(nodesWithMissingSymbols);
      // Expect SourceG, SourceH, SourceI
      expect(config.getAllSourceIds()).toEqual(
        expect.arrayContaining(["SourceG", "SourceH", "SourceI"])
      );
      expect(config.getAllSourceIds()).toHaveLength(3);
    });
  });
});
