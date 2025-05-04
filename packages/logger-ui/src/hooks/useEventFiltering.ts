import { useState, useMemo, useCallback } from "react";
import {
  SourceTreeNode,
  getAllSourceIds,
  sourceTreeData,
  sourceSymbols,
} from "../GameEventLogConfig";
import { EventLogEntry } from "../types"; // Assuming types are defined here or adjust path

interface UseEventFilteringResult {
  filterName: string;
  setFilterName: React.Dispatch<React.SetStateAction<string>>;
  allowedSources: Set<string>;
  handleSourceTreeToggle: (node: SourceTreeNode, isChecked: boolean) => void;
  filteredEvents: EventLogEntry[];
  eventsCountBySource: Record<string, number>;
}

export const useEventFiltering = (
  events: EventLogEntry[]
): UseEventFilteringResult => {
  const [filterName, setFilterName] = useState("");
  const [allowedSources, setAllowedSources] = useState<Set<string>>(
    new Set(getAllSourceIds(sourceTreeData)) // Initialize with all sources allowed
  );

  const handleSourceTreeToggle = useCallback(
    (node: SourceTreeNode, isChecked: boolean) => {
      setAllowedSources((prevAllowed) => {
        const newAllowed = new Set(prevAllowed);
        const idsToUpdate = getAllSourceIds([node]);

        // Update direct node and its potential children that are actual sources
        idsToUpdate.forEach((id: string) => {
          if (sourceSymbols[id]) {
            // Only modify known source types
            if (isChecked) {
              newAllowed.add(id);
            } else {
              newAllowed.delete(id);
            }
          }
        });

        // Explicitly handle children if the toggled node is a parent
        if (node.children && node.children.length > 0) {
          const childSourceIds = getAllSourceIds(node.children);
          childSourceIds.forEach((childId: string) => {
            if (sourceSymbols[childId]) {
              if (isChecked) {
                newAllowed.add(childId);
              } else {
                newAllowed.delete(childId);
              }
            }
          });
        }

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
    return counts;
  }, [filteredEvents]);

  return {
    filterName,
    setFilterName,
    allowedSources,
    handleSourceTreeToggle,
    filteredEvents,
    eventsCountBySource,
  };
};
