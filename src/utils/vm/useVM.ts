import React from "react";
import { VM } from "./VM";

export function useVMvalue<T>(vm: VM<T>): T;
export function useVMvalue<T>(vm: VM<T> | undefined | null): T | undefined;
export function useVMvalue<T>(vm: VM<T> | undefined | null): T | undefined {
  return React.useSyncExternalStore(
    React.useCallback(
      (onStoreChange) => (vm ? vm.subscribe(onStoreChange) : () => {}),
      [vm]
    ),
    () => (vm ? vm.val : undefined),
    () => (vm ? vm.val : undefined) // Server snapshot for SSR compatibility
  );
}
