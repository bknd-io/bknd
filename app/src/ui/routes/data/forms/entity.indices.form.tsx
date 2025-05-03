import { TbBolt, TbTrash } from "react-icons/tb";
import type { Entity } from "data/entities";
import { IconButton } from "ui/components/buttons/IconButton";
import { useBkndData } from "ui/client/schema/data/use-bknd-data";
import { CollapsibleList } from "ui/components/list/CollapsibleList";
import { EntityIndex } from "data";
import { Button } from "ui/components/buttons/Button";
import { useEffect, useState } from "react";
import { JsonViewer } from "ui/components/code/JsonViewer";
import type { TAppDataIndex } from "data/data-schema";
import * as Formy from "ui/components/form/Formy";

export interface EntityIndicesFormProps {
   entity: Entity;
   onChange?: (indices: Record<string, TAppDataIndex>) => void;
}

export function EntityIndicesForm({ entity, onChange }: EntityIndicesFormProps) {
   const { $data } = useBkndData();
   const [indices, setIndices] = useState<EntityIndex[]>($data.indicesOf(entity.name));
   const [create, setCreate] = useState<TAppDataIndex>({
      entity: entity.name,
      fields: [],
      unique: false,
   });
   const indexed_fields = indices.flatMap((i) => i.fields).map((f) => f.name);
   const required_fields = indices
      .flatMap((i) => i.fields)
      .filter((f) => f.isRequired())
      .map((f) => f.name);

   const fields = entity.fields.filter(
      (f) => !["primary", "relation", "media"].includes(f.type) && !indexed_fields.includes(f.name),
   );

   useEffect(() => {
      onChange?.(Object.fromEntries(indices.map((i) => [i.name, i.toJSON()])));
   }, [indices]);

   function handleAdd() {
      setIndices((prev) => [
         ...prev,
         new EntityIndex(
            entity,
            create.fields.map((f) => entity.fields.find((f2) => f2.name === f)!),
            create.unique,
         ),
      ]);
   }

   //console.log("indices", { indices, schema, config });
   return (
      <div className="flex flex-col gap-4">
         <div className="flex flex-col gap-2">
            {indices.map((index) => (
               <CollapsibleList.Item key={index.name} title={index.name}>
                  <CollapsibleList.Preview
                     left={<TbBolt />}
                     right={<IconButton size="lg" Icon={TbTrash} />}
                  >
                     <span>{index.fields.map((f) => f.name).join(", ")}</span>
                     <span className="opacity-50">{index.name}</span>
                  </CollapsibleList.Preview>
               </CollapsibleList.Item>
            ))}
         </div>
         <div className="flex flex-row gap-7 items-center">
            <span className="font-bold">Add Index</span>
            <div className="flex flex-row gap-2">
               <Formy.Label className="opacity-70">Unique</Formy.Label>
               <Formy.Switch
                  checked={create.unique}
                  size="sm"
                  onCheckedChange={(checked) => {
                     setCreate((prev) => ({
                        ...prev,
                        unique: checked,
                        fields: prev.fields.some((f) => required_fields.includes(f))
                           ? prev.fields
                           : [],
                     }));
                  }}
               />
            </div>
            <div className="flex flex-row flex-wrap gap-2 items-center">
               <Formy.Label className="opacity-70">Field</Formy.Label>
               <div className="min-w-0">
                  <Formy.Select
                     className="h-9 py-1.5 pl-3 pr-8"
                     options={fields.map((f) => ({
                        label: f.getLabel()!,
                        value: f.name,
                        disabled: create.unique && !required_fields.includes(f.name),
                     }))}
                     value={create.fields[0]}
                     onChange={(e) => {
                        setCreate((prev) => ({ ...prev, fields: [e.target.value] }));
                     }}
                  />
               </div>
            </div>
            <div className="flex flex-grow" />
            <Button variant="primary" disabled={create.fields.length === 0} onClick={handleAdd}>
               Add
            </Button>
         </div>
         <div>
            <JsonViewer
               json={{
                  create,
                  data: Object.fromEntries(indices.map((i) => [i.name, i.toJSON()])),
               }}
               expand={9}
            />
         </div>
      </div>
   );
}
