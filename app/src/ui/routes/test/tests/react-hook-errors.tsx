import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { TextInput } from "@mantine/core";
import { useForm } from "react-hook-form";
import { s } from "bknd/utils";

const schema = s.object({
   example: s.string().optional(),
   exampleRequired: s.string({ minLength: 2 }),
});

export default function ReactHookErrors() {
   const {
      register,
      handleSubmit,
      watch,
      formState: { errors },
   } = useForm({
      resolver: standardSchemaResolver(schema),
   });
   const data = watch();

   const onSubmit = (data) => console.log(data);

   console.log(watch("example")); // watch input value by passing the name of it
   console.log("errors", errors);

   return (
      /* "handleSubmit" will validate your inputs before invoking "onSubmit" */
      <form onSubmit={handleSubmit(onSubmit)}>
         {/* register your input into the hook by invoking the "register" function */}
         <TextInput defaultValue="test" {...register("example")} />

         {/* @ts-ignore include validation with required or other standard HTML validation rules */}
         <TextInput {...register("exampleRequired")} error={errors.exampleRequired?.message} />

         <div>
            <input type="submit" />
         </div>

         <div>
            {Object.entries(errors).map(([key, value]) => (
               <p key={key}>
                  {/* @ts-ignore */}
                  {key}: {value.message}
               </p>
            ))}
         </div>
      </form>
   );
}
