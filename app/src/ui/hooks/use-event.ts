// Userland polyfill while we wait for the forthcoming
// https://github.com/reactjs/rfcs/blob/useevent/text/0000-useevent.md
// Note: "A high-fidelity polyfill for useEvent is not possible because
// there is no lifecycle or Hook in React that we can use to switch
// .current at the right timing."
// So we will have to make do with this "close enough" approach for now.
import { useLayoutEffect, useRef } from "react";
import { isDebug } from "core/env";

export const useEvent = <Fn>(fn: Fn): Fn => {
   if (isDebug()) {
      //console.warn("useEvent() is deprecated");
   }
   return fn;
};
