import { objectTransform } from "core/utils";
import { Adapters } from "media";
import { registries } from "modules/registries";
import { s } from "core/object/schema";

export const ADAPTERS = {
   ...Adapters,
} as const;

export const registry = registries.media;

export function buildMediaSchema() {
   const adapterSchemaObject = objectTransform(registry.all(), (adapter, name) => {
      return s.strictObject(
         {
            type: s.literal(name),
            config: adapter.schema,
         },
         {
            title: adapter.schema?.title ?? name,
            description: adapter.schema?.description,
         },
      );
   });

   return s
      .strictObject(
         {
            enabled: s.boolean({ default: false }),
            basepath: s.string({ default: "/api/media" }),
            entity_name: s.string({ default: "media" }),
            storage: s
               .strictObject({
                  body_max_size: s.number({
                     description: "Max size of the body in bytes. Leave blank for unlimited.",
                  }),
               })
               .partial(),
            adapter: s.anyOf(Object.values(adapterSchemaObject)),
         },
         {
            default: {},
         },
      )
      .partial();
}

export const mediaConfigSchema = buildMediaSchema();
export type TAppMediaConfig = s.Static<typeof mediaConfigSchema>;
export type TAppMediaConfig2 = s.ObjectDefaults<(typeof mediaConfigSchema)["properties"]>;

const schema = s.strictObject(
   {
      enabled: s.boolean({ default: false }),
      basepath: s.string({ default: "/api/media" }),
      entity_name: s.string({ default: "media" }),
      storage: s
         .strictObject({
            body_max_size: s.number({
               description: "Max size of the body in bytes. Leave blank for unlimited.",
            }),
         })
         .partial(),
   },
   {
      default: {},
   },
);
