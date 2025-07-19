import { StringSchema, type IStringOptions } from "jsonv-ts";

export class SecretSchema<O extends IStringOptions> extends StringSchema<O> {}

export const secret = <O extends IStringOptions>(o?: O): SecretSchema<O> & O =>
   new SecretSchema(o) as any;
