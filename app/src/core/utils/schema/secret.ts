import type { s } from "bknd/utils";
import { StringSchema } from "jsonv-ts";

export class SecretSchema<O extends s.IStringOptions> extends StringSchema<O> {}

export const secret = <O extends s.IStringOptions>(o?: O): SecretSchema<O> & O =>
   new SecretSchema(o) as any;
