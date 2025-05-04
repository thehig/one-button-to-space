import React, { useState, useMemo, useEffect } from "react";
// EventLogEntry type is implicitly used via context, no need for direct import if not used elsewhere
// import { EventLogEntry } from "../types/events";
import { useCommunicationContext } from "../contexts/CommunicationContext"; // Import the hook

// TODO: Define an interface for the event log entry
// Remove the duplicate inline interface definition
/*
interface EventLogEntry {
  timestamp: string;
  source: string;
  eventName: string;
  data?: unknown;
}
*/

export const GameEventLog: React.FC = () => {
  const { events, clearLog } = useCommunicationContext(); // Use the context hook
  const [filterSourceText, setFilterSourceText] = useState(""); // Renamed for clarity
  const [filterName, setFilterName] = useState("");

  // --- Source Filtering State ---
  // Memoize the calculation of unique sources
  const uniqueSources = useMemo(() => {
    const sources = new Set(events.map((event) => event.source));
    return Array.from(sources).sort(); // Sort for consistent checkbox order
  }, [events]);

  // State to keep track of which sources are currently allowed/checked
  const [allowedSources, setAllowedSources] = useState<Set<string>>(
    new Set(uniqueSources)
  );

  // Effect to update allowed sources when new unique sources appear
  // This ensures new sources start checked by default
  useEffect(() => {
    setAllowedSources((currentAllowed) => {
      const newAllowed = new Set(currentAllowed);
      let changed = false;
      uniqueSources.forEach((source) => {
        // Add any new source that wasn't previously tracked
        if (!currentAllowed.has(source)) {
          newAllowed.add(source);
          changed = true;
        }
      });
      // If sources were added, return the new set, otherwise keep the old one stable
      return changed ? newAllowed : currentAllowed;
    });
  }, [uniqueSources]); // Rerun when the list of unique sources changes

  const handleSourceToggle = (source: string, isChecked: boolean) => {
    setAllowedSources((prevAllowed) => {
      const newAllowed = new Set(prevAllowed);
      if (isChecked) {
        newAllowed.add(source);
      } else {
        newAllowed.delete(source);
      }
      return newAllowed;
    });
  };
  // --- End Source Filtering State ---

  // Memoize the filtered events list
  const filteredEvents = useMemo(() => {
    return events.filter(
      (event) =>
        allowedSources.has(event.source) && // Check if source is allowed by checkbox
        (!filterSourceText ||
          event.source
            .toLowerCase()
            .includes(filterSourceText.toLowerCase())) && // Text filter
        (!filterName ||
          event.eventName.toLowerCase().includes(filterName.toLowerCase())) // Name filter
    );
  }, [events, allowedSources, filterSourceText, filterName]); // Dependencies for memoization

  const handleClearLog = () => {
    clearLog(); // Call clearLog from the context
    console.log("Clear log clicked via context");
  };

  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: "10px",
        margin: "10px",
        maxHeight: "400px", // Increased height a bit
        display: "flex", // Use flexbox for layout
        flexDirection: "column",
      }}
    >
      <h2>Game Event Log</h2>
      {/* Filter Controls Area */}
      <div
        style={{
          marginBottom: "10px",
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
        }}
      >
        {/* Text Filters */}
        <input
          type="text"
          placeholder="Filter by source text..."
          value={filterSourceText}
          onChange={(e) => setFilterSourceText(e.target.value)}
          style={{ padding: "5px" }}
        />
        <input
          type="text"
          placeholder="Filter by event name..."
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          style={{ padding: "5px" }}
        />
        <button onClick={handleClearLog} style={{ padding: "5px 10px" }}>
          Clear Log
        </button>

        {/* Source Checkboxes */}
        <div
          style={{
            borderTop: "1px solid #eee",
            marginTop: "10px",
            paddingTop: "10px",
            width: "100%",
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <span>Sources:</span>
          {uniqueSources.map((source) => (
            <label
              key={source}
              style={{
                display: "inline-flex",
                alignItems: "center",
                marginRight: "10px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={allowedSources.has(source)}
                onChange={(e) => handleSourceToggle(source, e.target.checked)}
                style={{ marginRight: "4px" }}
              />
              {source}
            </label>
          ))}
        </div>
      </div>

      {/* Event List Area */}
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          overflowY: "auto", // Make only this part scrollable
          flexGrow: 1, // Allow list to take remaining space
        }}
      >
        {filteredEvents.map((event, index) => (
          <li
            // Use a more stable key if possible, but index is fallback
            key={`${event.timestamp}-${event.source}-${event.eventName}-${index}`}
            style={{
              marginBottom: "5px",
              fontSize: "0.8em",
              borderBottom: "1px solid #eee",
              paddingBottom: "3px",
            }}
          >
            <strong>[{event.timestamp}]</strong> [{event.source}]{" "}
            {event.eventName}
            {/* Safely render event.data using JSON.stringify */}
            {event.data !== undefined && event.data !== null && (
              <pre
                style={{
                  margin: "2px 0 0 10px",
                  fontSize: "0.9em",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {JSON.stringify(event.data, null, 2)}
              </pre>
            )}
          </li>
        ))}
        {filteredEvents.length === 0 && <li>No events match filters.</li>}
      </ul>
    </div>
  );
};
