/* eslint-disable @typescript-eslint/no-explicit-any */
type Listener = (...args: any[]) => void;

export class EventEmitter {
  private events: { [key: string]: Listener[] } = {};

  on(event: string, listener: Listener): () => void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);

    // Return an unsubscribe function
    return () => this.off(event, listener);
  }

  off(event: string, listenerToRemove: Listener): void {
    if (!this.events[event]) return;

    this.events[event] = this.events[event].filter(
      (listener) => listener !== listenerToRemove
    );
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;

    this.events[event].forEach((listener) => listener(...args));
  }

  once(event: string, listener: Listener): () => void {
    const removeListener = this.on(event, (...args) => {
      listener(...args);
      removeListener(); // Unsubscribe after the first call
    });
    return removeListener; // Return the unsubscribe function
  }
}
