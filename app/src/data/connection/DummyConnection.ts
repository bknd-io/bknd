import { Connection, type FieldSpec, type SchemaResponse } from "./Connection";

export class DummyConnection extends Connection {
   constructor() {
      super(undefined as any);
   }

   override getFieldSchema(spec: FieldSpec, strict?: boolean): SchemaResponse {
      throw new Error("Method not implemented.");
   }
}
