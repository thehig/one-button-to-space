// Helper to format time difference
export const formatTimeDifference = (
  eventTimestampStr: string,
  initTime: Date | null // Allow null for safety
): string => {
  if (!initTime) {
    console.warn("formatTimeDifference called before initTime was set.");
    return `[${eventTimestampStr}]`; // Return raw timestamp if initTime is not ready
  }
  try {
    const eventTime = new Date(eventTimestampStr);
    const diffMs = eventTime.getTime() - initTime.getTime();
    if (isNaN(diffMs)) {
      // Handle invalid eventTimestampStr
      console.error(
        "formatTimeDifference: Failed to parse event timestamp:",
        eventTimestampStr
      );
      return `[Invalid Time: ${eventTimestampStr}]`;
    }
    // Allow negative differences for events logged slightly before official 'init'
    const diffSeconds = diffMs / 1000;
    const sign = diffSeconds < 0 ? "-" : "+";
    return `${sign}${Math.abs(diffSeconds).toFixed(3)} s`;
  } catch (e) {
    console.error(
      "formatTimeDifference: Error processing timestamp:",
      eventTimestampStr,
      e
    );
    return `[Error: ${eventTimestampStr}]`;
  }
};
