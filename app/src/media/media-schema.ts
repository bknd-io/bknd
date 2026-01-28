import { adapterSchemas } from "media/storage/adapter-schemas";
import { registries } from "modules/registries";
import { s, objectTransform } from "bknd/utils";
import { $object, $schema } from "modules/mcp";

// Export the registry for runtime adapter class lookups
export const registry = registries.media;

export function buildMediaSchema() {
   // Build adapter schema objects from the central schema definitions
   // This doesn't require importing actual adapter classes (which may have Node.js dependencies)
   const adapterSchemaObject = objectTransform(adapterSchemas, (schema, name) => {
      return s.strictObject(
         {
            type: s.literal(name),
            config: schema,
         },
         {
            title: schema?.title ?? name,
            description: schema?.description,
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
         // @todo: currently cannot be updated partially using mcp
         adapter: $schema(
            "config_media_adapter",
            s.anyOf(Object.values(adapterSchemaObject)),
         ).optional(),
      },
      {
         default: {},
      },
   ).strict();
}

export const mediaConfigSchema = buildMediaSchema();
export type TAppMediaConfig = s.Static<typeof mediaConfigSchema>;
