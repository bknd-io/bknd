import type { IconType } from "react-icons";
import { TbBox, TbCirclesRelation, TbPhoto } from "react-icons/tb";
import { twMerge } from "tailwind-merge";
import { ModalBody, ModalFooter, useStepContext } from "./CreateModal";
import Templates from "./templates/register";
import type { TCreateModalSchema, TSchemaAction } from "./schema";

export function StepSelect() {
   const { nextStep, stepBack, state, path, setState } = useStepContext<TCreateModalSchema>();
   const selected = state.action ?? null;

   function handleSelect(action: TSchemaAction) {
      if (selected === action) {
         nextStep(action)();
         return;
      }
      setState({ action });
   }

   return (
      <>
         <ModalBody>
            <p>Choose what type to add.</p>
            <div className="grid grid-cols-3 gap-3">
               <RadioCard
                  Icon={TbBox}
                  title="Entity"
                  description="Create a new entity with fields"
                  onClick={() => handleSelect("entity")}
                  selected={selected === "entity"}
               />
               <RadioCard
                  Icon={TbCirclesRelation}
                  title="Relation"
                  description="Create a new relation between entities"
                  onClick={() => handleSelect("relation")}
                  selected={selected === "relation"}
               />
               {/*<RadioCard
                  Icon={TbPhoto}
                  title="Attach Media"
                  description="Attach media to an entity"
                  onClick={() => handleSelect("media")}
                  selected={selected === "media"}
               />*/}
            </div>
            <div className="flex flex-col gap-2 mt-3">
               <h3 className="font-bold">Quick templates</h3>
               <div className="grid grid-cols-2 gap-3">
                  {Templates.map(([, template]) => (
                     <RadioCard
                        key={template.id}
                        compact
                        Icon={TbPhoto}
                        title={template.title}
                        description={template.description}
                        onClick={() => handleSelect(template.id)}
                        selected={selected === template.id}
                     />
                  ))}
               </div>
            </div>
         </ModalBody>
         <ModalFooter
            next={{
               onClick: selected && nextStep(selected),
               disabled: !selected,
            }}
            prev={{ onClick: stepBack }}
            prevLabel="Cancel"
            debug={{ state, path }}
         />
      </>
   );
}

const RadioCard = ({
   Icon,
   title,
   description,
   onClick,
   selected,
   compact = false,
   disabled = false,
}: {
   Icon: IconType;
   title: string;
   description?: string;
   selected?: boolean;
   onClick?: () => void;
   compact?: boolean;
   disabled?: boolean;
}) => {
   return (
      <div
         onClick={disabled !== true ? onClick : undefined}
         className={twMerge(
            "flex gap-3 border border-primary/10 rounded cursor-pointer",
            compact ? "flex-row p-4 items-center" : "flex-col p-5",
            selected ? "bg-primary/10 border-primary/50" : "hover:bg-primary/5",
            disabled && "opacity-50",
         )}
      >
         <Icon className="size-10" />
         <div className="flex flex-col leading-tight">
            <p className="text-lg font-bold">{title}</p>
            <p>{description}</p>
         </div>
      </div>
   );
};
