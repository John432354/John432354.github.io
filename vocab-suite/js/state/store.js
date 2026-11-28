/**
 * Lightweight Reactive State Store
 */

export class ReactiveStore {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setState(patchOrUpdater) {
    const patch =
      typeof patchOrUpdater === 'function' ? patchOrUpdater(this.state) : patchOrUpdater;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch {
        // ignore observer errors
      }
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
