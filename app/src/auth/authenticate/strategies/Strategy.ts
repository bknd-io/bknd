import type {
   Authenticator,
   StrategyAction,
   StrategyActionName,
   StrategyActions,
} from "../Authenticator";
import type { Hono } from "hono";
import type { Static, TSchema } from "@sinclair/typebox";
import { parse, type TObject } from "core/utils";

export type StrategyMode = "form" | "external";

export abstract class Strategy<Schema extends TSchema = TSchema> {
   protected actions: StrategyActions = {};

   constructor(
      protected config: Static<Schema>,
      public type: string,
      public name: string,
      public mode: StrategyMode,
   ) {
      // don't worry about typing, it'll throw if invalid
      this.config = parse(this.getSchema(), (config ?? {}) as any) as Static<Schema>;
   }

   protected registerAction<S extends TObject = TObject>(
      name: StrategyActionName,
      schema: S,
      preprocess: StrategyAction<S>["preprocess"],
   ): void {
      this.actions[name] = {
         schema,
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

   toJSON(secrets?: boolean): { type: string; config: Static<Schema> | {} | undefined } {
      return {
         type: this.getType(),
         config: secrets ? this.config : undefined,
      };
   }

   getActions(): StrategyActions {
      return this.actions;
   }
}
