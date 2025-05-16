import { describe, it, expect, beforeEach } from "vitest";
import { formatTimeDifference } from "./utils";
import {
  globalConsoleWarnSpy,
  globalConsoleErrorSpy,
} from "../../mocks/console";

describe("formatTimeDifference", () => {
  const initTime = new Date("2024-01-01T12:00:00.000Z");

  beforeEach(() => {
    globalConsoleWarnSpy.mockClear();
    globalConsoleErrorSpy.mockClear();
  });

  it("should return formatted positive difference for timestamp after initTime", () => {
    const eventTimestamp = "2024-01-01T12:00:01.500Z"; // 1.5 seconds after
    expect(formatTimeDifference(eventTimestamp, initTime)).toBe("+1.500 s");
  });

  it("should return formatted negative difference for timestamp before initTime", () => {
    const eventTimestamp = "2024-01-01T11:59:59.250Z"; // 0.750 seconds before
    expect(formatTimeDifference(eventTimestamp, initTime)).toBe("-0.750 s");
  });

  it("should return +0.000 s for timestamp equal to initTime", () => {
    const eventTimestamp = "2024-01-01T12:00:00.000Z";
    expect(formatTimeDifference(eventTimestamp, initTime)).toBe("+0.000 s");
  });

  it("should return raw timestamp if initTime is null", () => {
    const eventTimestamp = "2024-01-01T12:00:01.000Z";

    expect(formatTimeDifference(eventTimestamp, null)).toBe(
      `[${eventTimestamp}]`
    );
    expect(globalConsoleWarnSpy).toHaveBeenCalledWith(
      "formatTimeDifference called before initTime was set."
    );
  });

  it("should return invalid time format for invalid eventTimestampStr", () => {
    const invalidTimestamp = "not a valid date";

    expect(formatTimeDifference(invalidTimestamp, initTime)).toBe(
      `[Invalid Time: ${invalidTimestamp}]`
    );
    expect(globalConsoleErrorSpy).toHaveBeenCalledWith(
      "formatTimeDifference: Failed to parse event timestamp:",
      invalidTimestamp
    );
  });

  it("should handle potential errors during Date parsing gracefully", () => {
    const problematicTimestamp = "2024-13-01T12:00:00.000Z"; // Invalid month

    const result = formatTimeDifference(problematicTimestamp, initTime);

    if (result.startsWith("[Invalid Time:")) {
      expect(result).toBe(`[Invalid Time: ${problematicTimestamp}]`);
      expect(globalConsoleErrorSpy).toHaveBeenCalledWith(
        "formatTimeDifference: Failed to parse event timestamp:",
        problematicTimestamp
      );
    } else {
      expect(result).toBe(`[Error: ${problematicTimestamp}]`);
      expect(globalConsoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "formatTimeDifference: Error processing timestamp:"
        ),
        problematicTimestamp,
        expect.anything()
      );
    }
  });
});
