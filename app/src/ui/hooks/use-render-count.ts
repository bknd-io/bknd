import { useRef } from "react";

export function useRenderCount() {
   const count = useRef(0);
   count.current++;
   return count.current;
}
