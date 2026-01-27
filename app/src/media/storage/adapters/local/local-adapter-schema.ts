import { s } from "bknd/utils";

export const localAdapterConfig = s.object(
   {
      path: s.string({ default: "./" }),
   },
   { title: "Local", description: "Local file system storage", additionalProperties: false },
);
export type LocalAdapterConfig = s.Static<typeof localAdapterConfig>;
