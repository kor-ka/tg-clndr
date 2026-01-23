import React from "react";
import { VM } from "./VM";

export function useVMvalue<T>(vm: VM<T>) {
  return React.useSyncExternalStore(
    React.useCallback((onStoreChange) => vm.subscribe(onStoreChange), [vm]),
    () => vm.val,
    () => vm.val // Server snapshot for SSR compatibility
  );
}
