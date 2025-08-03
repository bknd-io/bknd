import type {
   Authenticator,
   StrategyAction,
   StrategyActionName,
   StrategyActions,
} from "../Authenticator";
import type { Hono } from "hono";
import { type s, parse } from "bknd/utils";

export type StrategyMode = "form" | "external";

export abstract class AuthStrategy<Schema extends s.Schema = s.Schema> {
   protected actions: StrategyActions = {};

   constructor(
      protected config: s.Static<Schema>,
      public type: string,
      public name: string,
      public mode: StrategyMode,
   ) {
      // don't worry about typing, it'll throw if invalid
      this.config = parse(this.getSchema(), (config ?? {}) as any) as s.Static<Schema>;
   }

   protected registerAction<S extends s.ObjectSchema = s.ObjectSchema>(
      name: StrategyActionName,
      schema: S,
      preprocess: StrategyAction<S>["preprocess"],
   ): void {
      this.actions[name] = {
         schema,
         // @ts-expect-error - @todo: fix this
         preprocess,
      } as const;
   }

   protected abstract getSchema(): Schema;

   abstract getController(auth: Authenticator): Hono;

   getType(): string {
      return this.type;
   }

   getMode() {
      return this.mode;
   }

   getName(): string {
      return this.name;
   }

   toJSON(secrets?: boolean): { type: string; config: s.Static<Schema> | {} | undefined } {
      return {
         type: this.getType(),
         config: secrets ? this.config : undefined,
      };
   }

   getActions(): StrategyActions {
      return this.actions;
   }
}
