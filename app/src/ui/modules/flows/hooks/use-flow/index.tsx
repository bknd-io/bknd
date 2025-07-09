import { MarkerType, type Node } from "@xyflow/react";
import type { TAppFlowSchema, TAppFlowTriggerSchema } from "flows/AppFlows";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { selectAtom } from "jotai/utils";
import { isEqual } from "lodash-es";
import type { ModuleSchemas } from "modules/ModuleManager";
import { createContext, useCallback, useContext, useEffect } from "react";
import { useBknd } from "ui/client/bknd";

export type TFlowNodeData = {
   label: string;
   type: string;
   last?: boolean;
   start?: boolean;
   responding?: boolean;
};

export type FlowContextType = {
   name?: string;
   data?: TAppFlowSchema;
   schema: ModuleSchemas["flows"]["properties"]["flows"];
   actions: {
      flow: {
         setName: (name: string) => Promise<any>;
      };
      trigger: {
         update: (trigger: TAppFlowTriggerSchema) => Promise<any>;
      };
      task: {
         create: (type: string, defaults?: object) => Promise<any>;
         update: (name: string, params: any) => Promise<any>;
      };
   };
};

export type TFlowState = {
   dirty: boolean;
   name?: string;
   flow?: TAppFlowSchema;
};
export const flowStateAtom = atom<TFlowState>({
   dirty: false,
   name: undefined,
   flow: undefined,
});

const FlowCanvasContext = createContext<FlowContextType>(undefined!);

const DEFAULT_FLOW: TAppFlowSchema = { trigger: { type: "manual" }, tasks: {}, connections: {} };
export function FlowCanvasProvider({ children, name }: { children: any; name?: string }) {
   //const [dirty, setDirty] = useState(false);
   const setFlowState = useSetAtom(flowStateAtom);
   const s = useBknd();
   const data = name ? (s.config.flows.flows[name] as TAppFlowSchema) : undefined;
   const schema = s.schema.flows.properties.flows;

   useEffect(() => {
      if (name) {
         setFlowState({ dirty: false, name, flow: data });
      }
   }, [name]);

   const actions = {
      flow: {
         setName: async (name: string) => {
            console.log("set name", name);
            setFlowState((state) => ({ ...state, name, dirty: true }));
         },
      },
      trigger: {
         update: async (trigger: TAppFlowTriggerSchema | any) => {
            console.log("update trigger", trigger);
            setFlowState((state) => {
               const flow = state.flow || (DEFAULT_FLOW as any);
               return { ...state, dirty: true, flow: { ...flow, trigger } };
            });
            //return s.actions.patch("flows", `flows.flows.${name}`, { trigger });
         },
      },
      task: {
         create: async (name: string, defaults: object = {}) => {
            console.log("create task", name, defaults);
            setFlowState((state) => {
               const flow = state.flow || (DEFAULT_FLOW as any);
               const tasks = { ...flow.tasks, [name]: defaults };
               return { ...state, dirty: true, flow: { ...flow, tasks } };
            });
         },

         update: async (name: string, params: any) => {
            console.log("update task", name, params);
            setFlowState((state) => {
               const flow = state.flow || (DEFAULT_FLOW as any);
               const task = { ...state.flow?.tasks?.[name], params };
               return {
                  ...state,
                  dirty: true,
                  flow: { ...flow, tasks: { ...flow.tasks, [name]: task } },
               };
            });
            //return s.actions.patch("flows", `flows.flows.${name}.tasks.${name}`, task);
         },
      },
   };

   return (
      <FlowCanvasContext.Provider value={{ name, data, schema, actions }}>
         {children}
      </FlowCanvasContext.Provider>
   );
}

export function useFlowCanvas() {
   return useContext(FlowCanvasContext);
}

export function useFlowCanvasState() {
   return useAtomValue(flowStateAtom);
}

export function useFlowSelector<Reduced = TFlowState>(
   selector: (state: TFlowState) => Reduced,
   equalityFn: (a: any, b: any) => boolean = isEqual,
) {
   const selected = selectAtom(flowStateAtom, useCallback(selector, []), equalityFn);
   return useAtom(selected)[0];
}

export function flowToNodes(flow: TAppFlowSchema, name: string): Node<TFlowNodeData>[] {
   const nodes: Node<TFlowNodeData>[] = [
      {
         id: "trigger",
         data: { label: name, type: flow.trigger.type },
         type: "trigger",
         dragHandle: ".drag-handle",
         position: { x: 0, y: 0 },
      },
   ];

   let i = 1;
   const count = Object.keys(flow.tasks ?? {}).length;
   for (const [name, task] of Object.entries(flow.tasks ?? {})) {
      const last = i === count;
      const start = i === 1;
      const responding = last;

      nodes.push({
         id: `task-${name}`,
         data: { label: name, type: task.type, last, start, responding },
         type: "task",
         dragHandle: ".drag-handle",
         // @todo: this is currently static
         position: { x: 450 * i + (i - 1) * 64, y: 0 },
      });
      i++;
   }

   /*nodes.push({
      id: "select",
      data: { label: "Select", type: "select" },
      type: "select",
      position: { x: 500 * i, y: 0 }
   });*/

   return nodes;
}

export function flowToEdges(flow: TAppFlowSchema) {
   const tasks = Object.entries(flow.tasks ?? {});
   if (tasks.length === 0) return [];

   const edges =
      tasks.length >= 1
         ? [
              {
                 id: "trigger-task",
                 source: "trigger",
                 target: `task-${tasks[0]?.[0]}`,
                 //type: "smoothstep",
                 style: {
                    strokeWidth: 2,
                 },
                 markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 10,
                    height: 10,
                 },
              },
           ]
         : [];

   for (const [id, connection] of Object.entries(flow.connections ?? {})) {
      edges.push({
         id,
         source: "task-" + connection.source,
         target: "task-" + connection.target,
         style: {
            strokeWidth: 2,
         },
         markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 10,
            height: 10,
         },
      });
   }

   return edges;
}
