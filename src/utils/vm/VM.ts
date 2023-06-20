export class VM<T> {
  #val: T;
  get val() {
    return this.#val
  }

  private listeners = new Set<(val: T) => void>();
  constructor(val: T) {
    this.#val = val;
  }

  readonly next = (val: T) => {
    this.#val = val;
    for (let listener of this.listeners) {
      listener(val);
    }
  };

  readonly unsubscribe = (listener: (val: T) => void) => {
    this.listeners.delete(listener);
  }

  readonly subscribe = (listener: (val: T) => void) => {
    this.listeners.add(listener);
    listener(this.#val);
    return () => {
      this.unsubscribe(listener);
    };
  };
}
