import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  PropsWithChildren,
} from "react";
import { CommunicationManager } from "../phaser/managers/CommunicationManager";
import { EventLogEntry } from "../types/events";

interface CommunicationContextType {
  events: EventLogEntry[];
  clearLog: () => void;
  // Potentially add filters state and setters here if context should manage them
}

const CommunicationContext = createContext<
  CommunicationContextType | undefined
>(undefined);

export const CommunicationProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const commManager = CommunicationManager.getInstance(); // Get singleton instance

  useEffect(() => {
    const handleNewEvent = (event: EventLogEntry) => {
      // Update state by adding the new event to the start of the array
      // console.log("CommunicationContext: Received new-event", event);
      setEvents((prevEvents) =>
        [event, ...prevEvents].slice(0, commManager.maxLogSize || 100)
      ); // Use maxLogSize from manager
    };

    const handleLogCleared = () => {
      setEvents([]);
    };

    // Initial load
    setEvents(commManager.getEventLog());

    // Subscribe to events
    commManager.on("new-event", handleNewEvent);
    commManager.on("log-cleared", handleLogCleared);

    // Cleanup on unmount
    return () => {
      commManager.off("new-event", handleNewEvent);
      commManager.off("log-cleared", handleLogCleared);
    };
  }, [commManager]); // Dependency array includes the manager instance

  const clearLog = () => {
    commManager.clearLog();
  };

  const value = {
    events,
    clearLog,
  };

  return (
    <CommunicationContext.Provider value={value}>
      {children}
    </CommunicationContext.Provider>
  );
};

export const useCommunicationContext = () => {
  const context = useContext(CommunicationContext);
  if (context === undefined) {
    throw new Error(
      "useCommunicationContext must be used within a CommunicationProvider"
    );
  }
  return context;
};
