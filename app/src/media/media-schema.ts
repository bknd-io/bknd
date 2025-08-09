import { MediaAdapters } from "media/media-registry";
import { registries } from "modules/registries";
import { s, objectTransform } from "bknd/utils";
import { $object, $record, $schema } from "modules/mcp";

export const ADAPTERS = {
   ...MediaAdapters,
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

   return $object(
      "config_media",
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
         adapter: $schema(
            "config_media_adapter",
            s.anyOf(Object.values(adapterSchemaObject)),
         ).optional(),
      },
      {
         default: {},
      },
   );
}

export const mediaConfigSchema = buildMediaSchema();
export type TAppMediaConfig = s.Static<typeof mediaConfigSchema>;
