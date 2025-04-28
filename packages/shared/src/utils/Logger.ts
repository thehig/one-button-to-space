// Define the source constant for logging
const LOGGER_SOURCE = "📜🔍"; // Chosen emojis for Logger

/**
 * Enum for log levels.
 */
export enum LogLevel {
  TRACE = -1, // Extremely verbose logging, potentially massive output
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4, // Special level to disable all logging
}

/**
 * Type definition for log filters.
 */
export type LogFilters = {
  level: LogLevel;
  sources: Set<string>;
};

/**
 * Static class for handling client-side logging.
 */
export class Logger {
  private static filters: LogFilters = {
    level: LogLevel.INFO, // Default log level
    sources: new Set<string>(), // Empty set means no source filtering by default
  };

  // Store the server-provided world creation time
  private static worldCreationTime: number | null = null;
  // Store the time the Logger module was initialized
  private static loggerStartTime = Date.now();

  // Private constructor to prevent instantiation
  private constructor() {}

  /**
   * Sets the log filtering configuration.
   * @param level - The minimum log level to display.
   * @param sources - Optional set of sources to exclusively log. If empty or undefined, all sources are logged.
   */
  public static setFilters(level: LogLevel, sources?: Set<string>): void {
    Logger.filters.level = level;
    Logger.filters.sources = sources || new Set<string>();
    // Use console.log directly here as this is internal logger setup info
    const timestamp = Logger.getCurrentTimestampString();
    const levelEmoji = "ℹ️"; // Info level for this internal message
    const source = LOGGER_SOURCE; // Source is the Logger class itself
    console.log(
      `${timestamp} ${levelEmoji}${source} Filters updated: Level=${
        LogLevel[level] || `Unknown(${level})`
      }, Sources=${
        sources && sources.size > 0 ? [...sources].join(", ") : "ALL"
      }`
    );
  }

  /**
   * Sets the world creation timestamp received from the server.
   * @param timestamp - The world creation timestamp (milliseconds since epoch).
   */
  public static setWorldCreationTime(timestamp: number): void {
    if (Logger.worldCreationTime === null) {
      Logger.worldCreationTime = timestamp;
      // Log confirmation using a placeholder or a specific message
      Logger.info(LOGGER_SOURCE, `World creation time set to: ${timestamp}`);
    } else {
      // Optionally warn if attempting to set it again
      Logger.warn(
        LOGGER_SOURCE,
        `Attempted to set world creation time again. Current: ${Logger.worldCreationTime}, New: ${timestamp}`
      );
    }
  }

  public static getWorldCreationTime(): number | null {
    if (Logger.worldCreationTime === null) {
      Logger.warn(LOGGER_SOURCE, "World creation time not set");
    }
    return Logger.worldCreationTime;
  }

  /**
   * Logs a trace message. For extremely verbose output.
   * @param source - The source of the log message.
   * @param message - The message to log.
   * @param optionalParams - Additional parameters to log.
   */
  public static trace(
    source: string,
    message: string,
    ...optionalParams: unknown[]
  ): void {
    Logger.log(LogLevel.TRACE, source, message, ...optionalParams);
  }

  /**
   * Logs a debug message.
   * @param source - The source of the log message (e.g., class or module name).
   * @param message - The message to log.
   * @param optionalParams - Additional parameters to log.
   */
  public static debug(
    source: string,
    message: string,
    ...optionalParams: unknown[]
  ): void {
    Logger.log(LogLevel.DEBUG, source, message, ...optionalParams);
  }

  /**
   * Logs an info message.
   * @param source - The source of the log message.
   * @param message - The message to log.
   * @param optionalParams - Additional parameters to log.
   */
  public static info(
    source: string,
    message: string,
    ...optionalParams: unknown[]
  ): void {
    Logger.log(LogLevel.INFO, source, message, ...optionalParams);
  }

  /**
   * Logs a warning message.
   * @param source - The source of the log message.
   * @param message - The message to log.
   * @param optionalParams - Additional parameters to log.
   */
  public static warn(
    source: string,
    message: string,
    ...optionalParams: unknown[]
  ): void {
    Logger.log(LogLevel.WARN, source, message, ...optionalParams);
  }

  /**
   * Logs an error message.
   * @param source - The source of the log message.
   * @param message - The message to log.
   * @param optionalParams - Additional parameters to log.
   */
  public static error(
    source: string,
    message: string,
    ...optionalParams: unknown[]
  ): void {
    Logger.log(LogLevel.ERROR, source, message, ...optionalParams);
  }

  /**
   * Gets the current timestamp string, formatted relative to world or logger start time.
   * @returns The formatted timestamp string (e.g., "W+12.345" or "L+0.123").
   */
  public static getCurrentTimestampString(): string {
    let timestampPrefix: string;
    let elapsedMs: number;

    if (Logger.worldCreationTime !== null) {
      elapsedMs = Date.now() - Logger.worldCreationTime;
      timestampPrefix = "🌍"; // World time
    } else {
      elapsedMs = Date.now() - Logger.loggerStartTime;
      timestampPrefix = "⏰"; // Logger time
    }

    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const elapsedMillis = elapsedMs % 1000;
    return `${timestampPrefix}${elapsedSeconds}.${elapsedMillis
      .toString()
      .padStart(3, "0")}`;
  }

  /**
   * Internal log method that applies filters and outputs to the console.
   * @param level - The log level of the message.
   * @param source - The source of the message.
   * @param message - The message content.
   * @param optionalParams - Additional data.
   */
  private static log(
    level: LogLevel,
    source: string,
    message: string,
    ...optionalParams: unknown[]
  ): void {
    // Filter by level
    if (level < Logger.filters.level) {
      return;
    }

    // Filter by source
    if (
      Logger.filters.sources.size > 0 &&
      !Logger.filters.sources.has(source)
    ) {
      return;
    }

    let timestampPrefix: string;
    let elapsedMs: number;

    if (Logger.worldCreationTime !== null) {
      elapsedMs = Date.now() - Logger.worldCreationTime;
      timestampPrefix = "🌍"; // World time
    } else {
      elapsedMs = Date.now() - Logger.loggerStartTime;
      timestampPrefix = "⏰"; // Logger time
    }

    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const elapsedMillis = elapsedMs % 1000;
    const timestamp = `${timestampPrefix}${elapsedSeconds}.${elapsedMillis
      .toString()
      .padStart(3, "0")}`;

    let levelEmoji: string;
    switch (level) {
      case LogLevel.TRACE:
        levelEmoji = "🔬"; // Microscope
        break;
      case LogLevel.DEBUG:
        levelEmoji = "🐞"; // Bug
        break;
      case LogLevel.INFO:
        levelEmoji = "ℹ️"; // Info
        break;
      case LogLevel.WARN:
        levelEmoji = "⚠️"; // Warning
        break;
      case LogLevel.ERROR:
        levelEmoji = "🔥"; // Error/Fire
        break;
      default:
        levelEmoji = "❓"; // Unknown
    }

    const prefix = `${timestamp} ${levelEmoji}${source}`;

    switch (level) {
      case LogLevel.TRACE: // Fall through to use console.log
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.info(prefix, message, ...optionalParams);
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, ...optionalParams);
        break;
      case LogLevel.ERROR:
        console.error(prefix, message, ...optionalParams);
        break;
    }
  }
}

// No longer exporting an instance, just the class itself.
// Callers will use Logger.info(...), Logger.error(...), etc.
