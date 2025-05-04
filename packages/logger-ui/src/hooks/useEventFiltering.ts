import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { SourceTreeNode } from "../types";
import { EventLogEntry } from "../types";

const DEBUG = false;

// --- Helper function (copied from TreeNode.tsx) ---
const getAllDescendantIds = (node: SourceTreeNode): string[] => {
  let ids = [node.id];
  if (node.children) {
    node.children.forEach((child) => {
      ids = ids.concat(getAllDescendantIds(child));
    });
  }
  return ids;
};

interface UseEventFilteringResult {
  filterName: string;
  setFilterName: React.Dispatch<React.SetStateAction<string>>;
  allowedSources: Set<string>;
  handleSourceTreeToggle: (node: SourceTreeNode, isChecked: boolean) => void;
  filteredEvents: EventLogEntry[];
  eventsCountBySource: Record<string, number>;
}

export const useEventFiltering = (
  events: EventLogEntry[],
  allSourceIdsFromConfig: string[] // New argument
): UseEventFilteringResult => {
  const [filterName, setFilterName] = useState("");
  const [allowedSources, setAllowedSources] = useState<Set<string>>(
    new Set(allSourceIdsFromConfig) // Initialize with IDs from config
  );

  // Ref to track the previous list of all source IDs
  const prevSourceIdsRef = useRef<string[]>(allSourceIdsFromConfig);

  // Effect to automatically enable newly added dynamic sources
  useEffect(() => {
    // Get the current and previous sets of IDs
    const currentIds = new Set(allSourceIdsFromConfig);
    const previousIds = new Set(prevSourceIdsRef.current);

    // Find IDs that are in the current list but not the previous one
    const newlyAddedIds: string[] = [];
    currentIds.forEach((id) => {
      if (!previousIds.has(id)) {
        newlyAddedIds.push(id);
      }
    });

    // If there are newly added IDs, update the allowedSources state
    if (newlyAddedIds.length > 0) {
      DEBUG &&
        console.log(
          `useEventFiltering: Auto-enabling new sources:`,
          newlyAddedIds
        );
      setAllowedSources((prevAllowed) => {
        const newAllowed = new Set(prevAllowed);
        newlyAddedIds.forEach((id) => newAllowed.add(id));
        return newAllowed;
      });
    }

    // Update the ref with the current IDs for the next render cycle
    prevSourceIdsRef.current = allSourceIdsFromConfig;
  }, [allSourceIdsFromConfig]); // Depend only on the list of all source IDs

  const handleSourceTreeToggle = useCallback(
    (node: SourceTreeNode, isChecked: boolean) => {
      setAllowedSources((prevAllowed) => {
        const newAllowed = new Set(prevAllowed);
        // Use the local helper to get all descendant IDs
        const idsToUpdate = getAllDescendantIds(node);

        // Update all descendant IDs based on the checkbox state
        idsToUpdate.forEach((id: string) => {
          if (isChecked) {
            newAllowed.add(id);
          } else {
            newAllowed.delete(id);
          }
        });

        return newAllowed;
      });
    },
    [] // No dependencies needed as it only uses Set state updater
  );

  const filteredEvents = useMemo(() => {
    return events.filter(
      (event) =>
        allowedSources.has(event.source) &&
        (!filterName ||
          event.eventName.toLowerCase().includes(filterName.toLowerCase()))
    );
  }, [events, allowedSources, filterName]);

  const eventsCountBySource = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredEvents.forEach((event) => {
      counts[event.source] = (counts[event.source] || 0) + 1;
    });
    // Also include counts for allowed sources that might have 0 events after filtering
    allSourceIdsFromConfig.forEach((id) => {
      if (!counts[id]) {
        counts[id] = 0;
      }
    });
    return counts;
    // Dependency on allSourceIdsFromConfig added
  }, [filteredEvents, allSourceIdsFromConfig]);

  return {
    filterName,
    setFilterName,
    allowedSources,
    handleSourceTreeToggle,
    filteredEvents,
    eventsCountBySource,
  };
};
