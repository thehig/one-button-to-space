import React, { useState, /* useEffect, */ useContext } from "react";
import { EventLogEntry } from "../types/events"; // Import the shared interface
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
  const [filterSource, setFilterSource] = useState("");
  const [filterName, setFilterName] = useState("");

  const filteredEvents = events.filter(
    (event) =>
      (!filterSource ||
        event.source.toLowerCase().includes(filterSource.toLowerCase())) &&
      (!filterName ||
        event.eventName.toLowerCase().includes(filterName.toLowerCase()))
  );

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
        maxHeight: "300px",
        overflowY: "auto",
      }}
    >
      <h2>Game Event Log</h2>
      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          placeholder="Filter by source..."
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          style={{ marginRight: "5px" }}
        />
        <input
          type="text"
          placeholder="Filter by event name..."
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          style={{ marginRight: "5px" }}
        />
        <button onClick={handleClearLog}>Clear Log</button>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {filteredEvents.map((event, index) => (
          <li
            key={index}
            style={{
              marginBottom: "5px",
              fontSize: "0.8em",
              borderBottom: "1px solid #eee",
            }}
          >
            <strong>[{event.timestamp}]</strong> [{event.source}]{" "}
            {event.eventName}
            {event.data && (
              <pre style={{ margin: "2px 0 0 10px", fontSize: "0.9em" }}>
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
