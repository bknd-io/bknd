import { boolean, datetime, json, number, text } from "data/prototype";

export const mediaFields = {
   path: text().required(),
   folder: boolean({ default_value: false, hidden: true, fillable: ["create"] }),
   mime_type: text(),
   size: number(),
   scope: text({ hidden: true, fillable: ["create"] }),
   etag: text(),
   modified_at: datetime(),
   reference: text(),
   entity_id: number(),
   metadata: json(),
};
