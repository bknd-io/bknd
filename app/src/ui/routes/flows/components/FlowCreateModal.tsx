import { typeboxResolver } from "@hookform/resolvers/typebox";
import { TextInput } from "@mantine/core";
import { useFocusTrap } from "@mantine/hooks";
import { TypeRegistry } from "@sinclair/typebox";
import { type Static, StringEnum, StringIdentifier, registerCustomTypeboxKinds } from "core/utils";
import { TRIGGERS } from "flows/flows-schema";
import { forwardRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useFlows } from "ui/client/schema/flows/use-flows";
import { MantineSegmentedControl } from "ui/components/form/hook-form-mantine/MantineSegmentedControl";
import {
   Modal2,
   type Modal2Ref,
   ModalBody,
   ModalFooter,
   ModalTitle,
} from "../../../components/modal/Modal2";
import { Step, Steps, useStepContext } from "../../../components/steps/Steps";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

registerCustomTypeboxKinds(TypeRegistry);

export type TCreateFlowModalSchema = any;
const triggerNames = Object.keys(TRIGGERS) as unknown as (keyof typeof TRIGGERS)[];

const schema = Type.Object({
   name: StringIdentifier,
   trigger: StringEnum(triggerNames),
   mode: StringEnum(["async", "sync"]),
});

export const FlowCreateModal = forwardRef<Modal2Ref>(function FlowCreateModal(props, ref) {
   const [path, setPath] = useState<string[]>([]);

   function close() {
      // @ts-ignore
      ref?.current?.close();
   }

   return (
      <Modal2 ref={ref} size="lg">
         <Steps path={path} lastBack={close}>
            <Step id="select">
               <ModalTitle path={["Create New Flow"]} onClose={close} />
               <StepCreate />
            </Step>
         </Steps>
      </Modal2>
   );
});

export function StepCreate() {
   const focusTrapRef = useFocusTrap();
   const { actions } = useFlows();
   const { nextStep, stepBack, state, setState } = useStepContext<TCreateFlowModalSchema>();
   const {
      handleSubmit,
      watch,
      control,
      register,
      formState: { isValid, errors },
   } = useForm({
      resolver: typeboxResolver(schema),
      defaultValues: {
         name: "",
         trigger: "manual",
         mode: "async",
      } as Static<typeof schema>,
      mode: "onSubmit",
   });

   async function onSubmit(data: Static<typeof schema>) {
      console.log(data, isValid);
      actions.flow.create(data.name, {
         trigger: {
            type: data.trigger,
            config: {
               mode: data.mode,
            },
         },
      });
   }
   console.log("errors", errors);

   return (
      <form ref={focusTrapRef} onSubmit={handleSubmit(onSubmit as any)}>
         <ModalBody className="min-h-40">
            <div>
               <TextInput
                  data-autofocus
                  label="Flow Name"
                  placeholder="Enter flow name"
                  error={errors.name?.message as any}
                  {...register("name", { required: true })}
               />
            </div>
            <div className="grid grid-cols-2 gap-6">
               <MantineSegmentedControl
                  label="Trigger Type"
                  name="trigger"
                  data={[
                     { label: "Manual", value: "manual" },
                     { label: "HTTP", value: "http" },
                     { label: "Event", value: "event" },
                  ]}
                  control={control}
               />
               <MantineSegmentedControl
                  label="Execution mode"
                  name="mode"
                  data={[
                     { label: "Async", value: "async" },
                     { label: "Sync", value: "sync" },
                  ]}
                  control={control}
               />
            </div>
            <pre>{JSON.stringify(watch(), null, 2)}</pre>
         </ModalBody>
         <ModalFooter
            next={{
               type: "submit",
               disabled: !isValid,
            }}
            nextLabel="Create"
            prev={{ onClick: stepBack }}
            prevLabel="Cancel"
         />
      </form>
   );
}
