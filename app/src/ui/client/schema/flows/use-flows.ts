import { parse } from "bknd/utils";
import { type TAppFlowSchema, flowSchema } from "flows/flows-schema";
import { useBknd } from "../../BkndProvider";

export function useFlows() {
   const { config, app, actions: bkndActions } = useBknd();

   const actions = {
      flow: {
         create: async (name: string, data: TAppFlowSchema) => {
            const parsed = parse(flowSchema, data, { skipMark: true, forceParse: true });
            const res = await bkndActions.add("flows", `flows.${name}`, parsed);
         },
      },
   };

   return { flows: app.flows, config: config.flows, actions };
}
