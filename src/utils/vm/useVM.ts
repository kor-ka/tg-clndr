import React from "react";
import { VM } from "./VM";
export function useVMvalue<T>(vm: VM<T>) {
  let [val, setValue] = React.useState(vm.val);
  React.useEffect(() => {
    return vm.subscribe(setValue);
  }, [vm]);
  return val;
}
