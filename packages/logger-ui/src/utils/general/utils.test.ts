import { describe, it, expect, vi } from "vitest";
import { formatTimeDifference } from "./utils";

describe("formatTimeDifference", () => {
  const initTime = new Date("2024-01-01T12:00:00.000Z");

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
    // Spy on console.warn to check if it logs the warning
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(formatTimeDifference(eventTimestamp, null)).toBe(
      `[${eventTimestamp}]`
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "formatTimeDifference called before initTime was set."
    );

    warnSpy.mockRestore(); // Clean up spy
  });

  it("should return invalid time format for invalid eventTimestampStr", () => {
    const invalidTimestamp = "not a valid date";
    // Spy on console.error to check if it logs the error
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(formatTimeDifference(invalidTimestamp, initTime)).toBe(
      `[Invalid Time: ${invalidTimestamp}]`
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "formatTimeDifference: Failed to parse event timestamp:",
      invalidTimestamp
    );

    errorSpy.mockRestore(); // Clean up spy
  });

  it("should handle potential errors during Date parsing gracefully", () => {
    const problematicTimestamp = "2024-13-01T12:00:00.000Z"; // Invalid month
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Depending on the environment, Date parsing might throw or return NaN
    // The function should catch errors or handle NaN from getTime()
    const result = formatTimeDifference(problematicTimestamp, initTime);

    // Check if it resulted in NaN case or caught an error
    if (result.startsWith("[Invalid Time:")) {
      expect(result).toBe(`[Invalid Time: ${problematicTimestamp}]`);
      expect(errorSpy).toHaveBeenCalledWith(
        "formatTimeDifference: Failed to parse event timestamp:",
        problematicTimestamp
      );
    } else {
      // Assume generic error case was triggered if not NaN
      expect(result).toBe(`[Error: ${problematicTimestamp}]`);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "formatTimeDifference: Error processing timestamp:"
        ),
        problematicTimestamp,
        expect.anything() // Match the error object
      );
    }
    errorSpy.mockRestore();
  });
});
