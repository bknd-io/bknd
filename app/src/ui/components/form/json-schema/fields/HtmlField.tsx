import type { FieldProps } from "@rjsf/utils";
import { Label } from "../templates/FieldTemplate";
import { HtmlEditor } from "ui/components/code/HtmlEditor";

// @todo: move editor to lazy loading component
export default function HtmlField({
   formData,
   onChange,
   disabled,
   readonly,
   ...props
}: FieldProps) {
   function handleChange(data) {
      onChange(data);
   }

   const isDisabled = disabled || readonly;
   const id = props.idSchema.$id;

   return (
      <div className="flex flex-col gap-2">
         <Label label={props.name} id={id} />
         <HtmlEditor value={formData} editable={!isDisabled} onChange={handleChange} />
      </div>
   );
}
