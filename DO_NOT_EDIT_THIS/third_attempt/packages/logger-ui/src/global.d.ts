/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    // Properties used by GameEventLog.test.tsx to backup original console methods
    __console_log_original?: (...args: any[]) => void;
    __console_warn_original?: (...args: any[]) => void;
    __console_error_original?: (...args: any[]) => void;
  }
}

// This export is needed to treat the file as a module
export {};
