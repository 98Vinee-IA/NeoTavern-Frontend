type Listener = (...args: any[]) => void;

class EventEmitter {
  private events: Record<string, Listener[]> = {};

  on(eventName: string, listener: Listener): () => void {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(listener);

    // Return an `off` function for easy cleanup
    return () => this.off(eventName, listener);
  }

  off(eventName: string, listener: Listener): void {
    if (!this.events[eventName]) {
      return;
    }
    const index = this.events[eventName].indexOf(listener);
    if (index > -1) {
      this.events[eventName].splice(index, 1);
    }
  }

  emit(eventName: string, ...args: any[]): void {
    if (!this.events[eventName]) {
      return;
    }
    // Call listeners on a copy in case one of them modifies the list
    [...this.events[eventName]].forEach((listener) => {
      listener(...args);
    });
  }
}

export const eventEmitter = new EventEmitter();
