export interface Serializable<Class, Json extends object = object> {
   toJSON(): Json;
   fromJSON(json: Json): Class;
}

export type MaybePromise<T> = T | Promise<T>;

export type PartialRec<T> = { [P in keyof T]?: PartialRec<T[P]> };

export type Merge<T> = {
   [K in keyof T]: T[K];
};
