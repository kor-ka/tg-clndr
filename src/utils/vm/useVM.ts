import React from "react";
import { VM } from "./VM";
export function useVMvalue<T>(vm: VM<T>) {
  let [val, setValue] = React.useState(vm.val);
  React.useLayoutEffect(() => {
    // Sync value immediately when VM reference changes (before paint)
    setValue(vm.val);
    return vm.subscribe(setValue);
  }, [vm]);
  return val;
}
