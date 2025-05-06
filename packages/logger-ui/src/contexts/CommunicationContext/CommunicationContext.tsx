import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  PropsWithChildren,
} from "react";
import { CommunicationManager } from "../../managers/CommunicationManager/CommunicationManager";
import { EventLogEntry } from "../../types";

// Define props interface
interface CommunicationProviderProps {
  maxLogSize?: number;
  redirectEventsToConsole?: boolean;
}

interface CommunicationContextType {
  events: EventLogEntry[];
  clearLog: () => void;
  // Potentially add filters state and setters here if context should manage them
  logEvent: (
    source: string,
    eventName: string,
    data?:
      | Record<string, unknown>
      | unknown[]
      | string
      | number
      | boolean
      | null
  ) => void;
}

const CommunicationContext = createContext<
  CommunicationContextType | undefined
>(undefined);

export const CommunicationProvider: React.FC<
  PropsWithChildren<CommunicationProviderProps>
> = ({
  children,
  maxLogSize = 100, // Destructure prop with default value
  redirectEventsToConsole = false, // <-- Destructure new prop
}) => {
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const commManager = CommunicationManager.getInstance(); // Get singleton instance

  // NEW: Effect to set the max log size on the manager
  useEffect(() => {
    if (maxLogSize !== undefined) {
      // console.log(`CommunicationContext: Setting maxLogSize to ${maxLogSize}`);
      commManager.setMaxLogSize(maxLogSize);
      // Refresh the log state in case the manager trimmed it
      setEvents(commManager.getEventLog());
    }
  }, [maxLogSize, commManager]);

  // NEW: Effect to set the console redirection flag on the manager
  useEffect(() => {
    if (redirectEventsToConsole !== undefined) {
      commManager.setRedirectEventsToConsole(redirectEventsToConsole);
    }
  }, [redirectEventsToConsole, commManager]);

  // Effect to handle events from the manager
  useEffect(() => {
    // Initial load - Get the log from the manager
    setEvents(commManager.getEventLog());

    // Handler for new events - Get the updated log from the manager
    const handleNewEvent = (/* event: EventLogEntry - No longer needed */) => {
      // Get the latest log directly from the manager,
      // which is already responsible for trimming.
      // console.log("CommunicationContext: Received new-event, updating log from manager");
      setEvents(commManager.getEventLog());
    };

    // Handler for log cleared - Clear local state
    const handleLogCleared = () => {
      // console.log("CommunicationContext: Received log-cleared");
      setEvents([]);
    };

    // Subscribe to manager events
    commManager.on("new-event", handleNewEvent);
    commManager.on("log-cleared", handleLogCleared);

    // Cleanup on unmount
    return () => {
      commManager.off("new-event", handleNewEvent);
      commManager.off("log-cleared", handleLogCleared);
    };
    // Dependency array: only depends on the manager instance
  }, [commManager]);

  const clearLog = () => {
    commManager.clearLog();
  };

  const value = {
    events,
    clearLog,
    logEvent: commManager.logEvent.bind(commManager),
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
