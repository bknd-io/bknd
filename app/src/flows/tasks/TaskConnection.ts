import { objectCleanEmpty, uuid } from "bknd/utils";
import { get } from "lodash-es";
import type { Task, TaskResult } from "./Task";

type TaskConnectionConfig = {
   condition?: Condition;
   max_retries?: number;
};

export class TaskConnection {
   source: Task;
   target: Task;
   config: TaskConnectionConfig;
   public id: string;

   constructor(source: Task, target: Task, config?: TaskConnectionConfig, id?: string) {
      this.source = source;
      this.target = target;
      this.config = config ?? {};

      if (!(this.config.condition instanceof Condition)) {
         this.config.condition = Condition.default();
      }

      this.id = id ?? uuid();
   }

   get condition(): Condition {
      return this.config.condition as any;
   }

   get max_retries(): number {
      return this.config.max_retries ?? 0;
   }

   toJSON() {
      return objectCleanEmpty({
         source: this.source.name,
         target: this.target.name,
         config: {
            ...this.config,
            condition: this.config.condition?.toJSON(),
         },
      });
   }
}

export class Condition {
   private constructor(
      public type: "success" | "error" | "matches",
      public path: string = "",
      public value: any = undefined,
   ) {}

   static default() {
      return Condition.success();
   }

   static success() {
      return new Condition("success");
   }

   static error() {
      return new Condition("error");
   }

   static matches(path: string, value: any) {
      if (typeof path !== "string" || path.length === 0) {
         throw new Error("Invalid path");
      }

      return new Condition("matches", path, value);
   }

   isMet(result: TaskResult) {
      switch (this.type) {
         case "success":
            return result.success;
         case "error":
            return result.success === false;
         case "matches":
            return get(result.output, this.path) === this.value;
      }
   }

   sameAs(condition: Condition = Condition.default()) {
      return (
         this.type === condition.type &&
         this.path === condition.path &&
         this.value === condition.value
      );
   }

   toJSON() {
      return {
         type: this.type,
         path: this.path.length === 0 ? undefined : this.path,
         value: this.value,
      };
   }

   static fromObject(obj: ReturnType<Condition["toJSON"]>) {
      return new Condition(obj.type, obj.path, obj.value);
   }
}
