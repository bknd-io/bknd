import { s } from "core/object/schema";

export const mediaConfigSchema = s.strictObject(
   {
      enabled: s.boolean({ default: false }),
      basepath: s.string({ default: "/api/media" }),
      entity_name: s.string({ default: "media" }),
      storage: s.strictObject(
         {
            body_max_size: s
               .number({
                  description: "Max size of the body in bytes. Leave blank for unlimited.",
               })
               .optional(),
         },
         { default: {} },
      ),
      adapter: s
         .strictObject({
            type: s.string(),
            config: s.any(),
         })
         .optional(),
   },
   {
      default: {},
   },
);
export type TAppMediaConfig = s.Static<typeof mediaConfigSchema>;
