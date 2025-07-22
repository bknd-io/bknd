import { Input, TextInput } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconMinus, IconPlus, IconWorld } from "@tabler/icons-react";
import type { Node, NodeProps } from "@xyflow/react";
import { s } from "bknd/utils";
import { FetchTask } from "flows";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "ui/components/buttons/Button";
import { JsonViewer } from "ui/components/code/JsonViewer";
import { SegmentedControl } from "ui/components/form/SegmentedControl";
import { MantineSelect } from "ui/components/form/hook-form-mantine/MantineSelect";
import type { TFlowNodeData } from "../../../hooks/use-flow";
import { KeyValueInput } from "../../form/KeyValueInput";
import { BaseNode } from "../BaseNode";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";

const schema = s.object({
   query: s.record(s.string()).optional(),
   ...FetchTask.schema.properties,
});

type TFetchTaskSchema = s.Static<typeof FetchTask.schema>;
type FetchTaskFormProps = NodeProps<Node<TFlowNodeData>> & {
   params: TFetchTaskSchema;
   onChange: (params: any) => void;
};

export function FetchTaskForm({ onChange, params, ...props }: FetchTaskFormProps) {
   const [advanced, toggle] = useToggle([true, false]);
   const [bodyType, setBodyType] = useState("None");
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
      defaultValues: params as s.Static<typeof schema>,
      mode: "onChange",
      //defaultValues: (state.relations?.create?.[0] ?? {}) as Static<typeof schema>
   });

   function onSubmit(data) {
      console.log("submit task", data);
      onChange(data);
   }

   //console.log("FetchTaskForm", watch());
   return (
      <BaseNode
         {...props}
         isInvalid={!isValid}
         className="w-[400px]"
         Icon={IconWorld}
         tabs={TaskNodeTabs({ watch })}
         onChangeName={console.log}
      >
         <form onBlur={handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="flex flex-row gap-2 items-center">
               <MantineSelect
                  className="w-36"
                  label="Method"
                  defaultValue="GET"
                  data={["GET", "POST", "PATCH", "PUT", "DEL"]}
                  name="method"
                  control={control}
               />
               <TextInput
                  className="w-full"
                  label="Mapping Path"
                  placeholder="/path/to-be/mapped"
                  classNames={{ wrapper: "font-mono pt-px" }}
                  {...register("url")}
               />
            </div>

            <Button
               onClick={toggle as any}
               className="justify-center"
               size="small"
               variant="ghost"
               iconSize={14}
               IconLeft={advanced ? IconMinus : IconPlus}
            >
               More options
            </Button>

            {advanced && (
               <>
                  <KeyValueInput
                     label="URL query"
                     onChange={(items: any) => setValue("query", items)}
                     error={errors.query?.message}
                  />
                  <KeyValueInput label="Headers" />
                  <div className="flex flex-row gap-2 items-center mt-2">
                     <Input.Wrapper className="w-full">
                        <div className="flex flex-row gap-2 items-center">
                           <Input.Label>Body</Input.Label>
                           <SegmentedControl
                              data={["None", "Form", "JSON", "Code"]}
                              size="xs"
                              defaultValue={bodyType}
                              onChange={(value) => setBodyType(value)}
                           />
                        </div>
                        {bodyType === "Form" && <KeyValueInput label={undefined} />}
                        {bodyType === "JSON" && <KeyValueInput label={undefined} />}
                     </Input.Wrapper>
                  </div>
               </>
            )}
         </form>
      </BaseNode>
   );
}

const TaskNodeTabs = ({ watch }: any) => [
   {
      id: "json",
      label: "JSON",
      content: () => (
         <div className="scroll-auto">
            <JsonViewer json={watch()} expand={2} className="bg-white break-all" />
         </div>
      ),
   },
   {
      id: "test",
      label: "test",
      content: () => <div>test</div>,
   },
];
