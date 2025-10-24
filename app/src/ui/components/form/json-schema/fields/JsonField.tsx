import type { FieldProps } from "@rjsf/utils";
import { JsonEditor } from "../../../code/JsonEditor";
import { Label } from "../templates/FieldTemplate";

// @todo: move editor to lazy loading component
export default function JsonField({
   formData,
   onChange,
   disabled,
   readonly,
   ...props
}: FieldProps) {
   const isDisabled = disabled || readonly;
   const id = props.idSchema.$id;

   return (
      <div className="flex flex-col gap-2">
         <Label label={props.name} id={id} />
         <JsonEditor value={formData} editable={!isDisabled} onChange={onChange} />
      </div>
   );
}
