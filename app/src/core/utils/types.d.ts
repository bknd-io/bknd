export type Prettify<T> = {
   [K in keyof T]: T[K];
} & NonNullable<unknown>;

// prettify recursively
export type PrettifyRec<T> = {
   [K in keyof T]: T[K] extends object ? Prettify<T[K]> : T[K];
} & NonNullable<unknown>;

export type RecursivePartial<T> = {
   [P in keyof T]?: T[P] extends (infer U)[]
      ? RecursivePartial<U>[]
      : T[P] extends object | undefined
        ? RecursivePartial<T[P]>
        : T[P];
};
