/**
 * Example: Value Model (VM) Pattern
 *
 * This is the core reactive state management pattern used throughout the client.
 * It provides a lightweight observable implementation for reactive updates.
 *
 * Key Features:
 * - Private fields using # syntax (ES2022)
 * - Subscribe/unsubscribe mechanism
 * - Immediate or deferred notifications
 * - Type-safe with TypeScript generics
 */

/**
 * The VM class implementation (from src/utils/vm/VM.ts)
 */
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

  readonly subscribe = (listener: (val: T) => void, imidiate = true) => {
    this.listeners.add(listener);
    if(imidiate){
        listener(this.#val);
    }
    return () => {
      this.unsubscribe(listener);
    };
  };
}

/**
 * Example: Using VM in a Module
 * Pattern for managing a collection of reactive values
 */
import { Event } from "../shared/entity";

export class EventsModule {
  // Map of event IDs to their VMs
  private events = new Map<string, VM<Event>>();

  /**
   * Get or create a VM for an event
   */
  getEventVM(eventId: string): VM<Event> | undefined {
    return this.events.get(eventId);
  }

  /**
   * Update an event (creates VM if doesn't exist)
   */
  updateEventVM(event: Event) {
    let vm = this.events.get(event.id);
    if (!vm) {
      // Create new VM
      vm = new VM(event);
      this.events.set(event.id, vm);
    } else {
      // Update existing VM (triggers all listeners)
      vm.next(event);
    }
  }

  /**
   * React hook for using VM value in components
   * This pattern is defined in src/utils/vm/useVM.ts
   */
  useEvent(eventId: string): Event | undefined {
    const vm = this.getEventVM(eventId);
    // useVMvalue handles subscription/unsubscription automatically
    return useVMvalue(vm);
  }
}

/**
 * Example: Using VM in React Components
 */
import React from "react";
import { useVMvalue } from "../utils/vm/useVM";

const EventComponent = ({ eventId, model }: { eventId: string, model: SessionModel }) => {
  // This hook automatically subscribes to the VM and re-renders on changes
  const event = useVMvalue(model.eventsModule.getEventVM(eventId));

  if (!event) {
    return <div>Event not found</div>;
  }

  return (
    <div>
      <h1>{event.title}</h1>
      <p>{event.description}</p>
    </div>
  );
};

/**
 * Example: Manual Subscription (Advanced)
 * Rarely needed, but useful for side effects
 */
const ManualSubscriptionExample = ({ eventId, model }: Props) => {
  React.useEffect(() => {
    const vm = model.eventsModule.getEventVM(eventId);
    if (!vm) return;

    // Subscribe with immediate callback (default)
    const unsubscribe = vm.subscribe((event) => {
      console.log("Event updated:", event);
      // Perform side effect
    });

    // Cleanup on unmount
    return unsubscribe;
  }, [eventId, model]);

  return <div>...</div>;
};

/**
 * Example: VM for Simple State
 * Can also be used for single values, not just collections
 */
export class SessionModel {
  // Single VM for chat settings
  readonly chatSettings = new VM<ChatSettings>({
    allowPublicEdit: false,
    enableEventMessages: false
  });

  // Update settings
  updateSettings(settings: ChatSettings) {
    this.chatSettings.next(settings);
  }
}

// Usage in component
const SettingsComponent = ({ model }: { model: SessionModel }) => {
  const settings = useVMvalue(model.chatSettings);

  return (
    <div>
      <p>Public Edit: {settings.allowPublicEdit ? 'Yes' : 'No'}</p>
      <p>Event Messages: {settings.enableEventMessages ? 'Yes' : 'No'}</p>
    </div>
  );
};

/**
 * Why VM instead of Redux/MobX?
 *
 * 1. Lightweight: ~30 lines of code, no external dependencies
 * 2. Type-safe: Full TypeScript support with generics
 * 3. Simple: Easy to understand and debug
 * 4. Performant: Direct subscriptions, no middleware
 * 5. Flexible: Works with any data structure
 * 6. Perfect for this project: Small to medium complexity
 *
 * Trade-offs:
 * - No time-travel debugging (use Redux DevTools if needed)
 * - No built-in middleware (add manually if needed)
 * - Manual subscription management (but hooks make it easy)
 */
