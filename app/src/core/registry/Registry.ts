export type Constructor<T> = new (...args: any[]) => T;
export type ClassThatImplements<T> = Constructor<T> & { prototype: T };
export type RegisterFn<Item> = (unknown: any) => Item;

export class Registry<
   Item,
   Items extends Record<string, Item> = Record<string, Item>,
   Fn extends RegisterFn<Item> = RegisterFn<Item>,
> {
   private is_set: boolean = false;
   private items: Items = {} as Items;

   constructor(private registerFn?: Fn) {}

   set<Actual extends Record<string, Item>>(items: Actual) {
      if (this.is_set) {
         throw new Error("Registry is already set");
      }
      this.items = items as unknown as Items;
      this.is_set = true;

      return this as unknown as Registry<Item, Actual, Fn>;
   }

   add(name: string, item: Item) {
      this.items[name as keyof Items] = item as Items[keyof Items];
      return this;
   }

   register(name: string, specific: Parameters<Fn>[0]) {
      if (this.registerFn) {
         const item = this.registerFn(specific);
         this.items[name as keyof Items] = item as Items[keyof Items];
         return this;
      }

      return this.add(name, specific);
   }

   get<Name extends keyof Items>(name: Name): Items[Name] {
      return this.items[name];
   }

   has(name: keyof Items): boolean {
      return name in this.items;
   }

   all() {
      return this.items;
   }
}
