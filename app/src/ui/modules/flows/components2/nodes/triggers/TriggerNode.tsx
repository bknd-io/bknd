import { TextInput } from "@mantine/core";
import type { Node, NodeProps } from "@xyflow/react";
import { transformObject } from "core/utils";
import { TriggerMap } from "flows";
import type { TAppFlowTriggerSchema } from "flows/AppFlows";
import { useForm } from "react-hook-form";
import { JsonViewer } from "ui/components/code/JsonViewer";
import { MantineSegmentedControl } from "ui/components/form/hook-form-mantine/MantineSegmentedControl";
import { MantineSelect } from "ui/components/form/hook-form-mantine/MantineSelect";
import { useFlowCanvas, useFlowSelector } from "../../../hooks/use-flow";
import { BaseNode } from "../BaseNode";
import { Handle } from "../Handle";
import { s } from "bknd/utils";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";

const schema = s.object({
   trigger: s.anyOf(
      Object.values(
         transformObject(TriggerMap, (trigger, name) =>
            s.strictObject(
               {
                  type: s.literal(name),
                  config: trigger.cls.schema,
               },
               { title: String(name) },
            ),
         ),
      ),
   ),
});

export const TriggerNode = (props: NodeProps<Node<TAppFlowTriggerSchema & { label: string }>>) => {
   const {
      data: { label, ...trigger },
   } = props;
   //console.log("TriggerNode");
   const state = useFlowSelector((s) => s.flow!.trigger!);
   const { actions } = useFlowCanvas();

   const {
      register,
      handleSubmit,
      setValue,
      getValues,
      formState: { isValid, errors },
      watch,
      control,
   } = useForm({
      resolver: standardSchemaResolver(schema),
      defaultValues: { trigger: state } as s.Static<typeof schema>,
      mode: "onChange",
   });
   const data = watch("trigger");

   async function onSubmit(data: s.Static<typeof schema>) {
      console.log("submit", data.trigger);
      // @ts-ignore
      await actions.trigger.update(data.trigger);
   }

   async function onChangeName(name: string) {
      console.log("change name", name);
      await actions.flow.setName(name);
   }

   /*useEffect(() => {
      console.log("trigger update", data);
      actions.trigger.update(data);
   }, [data]);*/

   return (
      <BaseNode {...props} tabs={TriggerNodeTabs({ data })} onChangeName={onChangeName}>
         <form onBlur={handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="flex flex-row justify-between items-center">
               <MantineSegmentedControl
                  label="Trigger Type"
                  defaultValue="manual"
                  data={[
                     { label: "Manual", value: "manual" },
                     { label: "HTTP", value: "http" },
                     { label: "Event", value: "event", disabled: true },
                  ]}
                  name="trigger.type"
                  control={control}
               />
               <MantineSegmentedControl
                  label="Execution Mode"
                  defaultValue="async"
                  data={[
                     { label: "Async", value: "async" },
                     { label: "Sync", value: "sync" },
                  ]}
                  name="trigger.config.mode"
                  control={control}
               />
            </div>
            {data?.type === "manual" && <Manual />}
            {data?.type === "http" && (
               <Http form={{ watch, register, setValue, getValues, control }} />
            )}
         </form>
         <Handle type="source" id="trigger-out" />
      </BaseNode>
   );
};

const Manual = () => {
   return null;
};

const Http = ({ form }) => {
   return (
      <>
         <div className="flex flex-row gap-2 items-center">
            <MantineSelect
               className="w-36"
               label="Method"
               data={["GET", "POST", "PATCH", "PUT", "DEL"]}
               name="trigger.config.method"
               control={form.control}
            />
            <TextInput
               className="w-full"
               label="Mapping Path"
               placeholder="/trigger_http"
               classNames={{ wrapper: "font-mono pt-px" }}
               {...form.register("trigger.config.path")}
            />
         </div>
         <div className="flex flex-row gap-2 items-center">
            <MantineSegmentedControl
               className="w-full"
               label="Response Type"
               defaultValue="json"
               data={[
                  { label: "JSON", value: "json" },
                  { label: "HTML", value: "html" },
                  { label: "Text", value: "text" },
               ]}
               name="trigger.config.response_type"
               control={form.control}
            />
         </div>
      </>
   );
};

const TriggerNodeTabs = ({ data, ...props }) => [
   {
      id: "json",
      label: "JSON",
      content: () => <JsonViewer json={data} expand={2} className="" />,
   },
   {
      id: "test",
      label: "test",
      content: () => <div>test</div>,
   },
];
