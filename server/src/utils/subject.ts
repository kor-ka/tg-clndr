export class Subject<T> {
  private listeners = new Set<(val: T) => void>();
  subscribe = (listener: (val: T) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  next = (val: T) => {
    this.listeners.forEach((l) => l(val));
  };
}
