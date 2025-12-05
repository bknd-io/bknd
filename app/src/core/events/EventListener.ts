import type { MaybePromise } from "bknd";
import type { Event } from "./Event";
import type { EventClass } from "./EventManager";

export const ListenerModes = ["sync", "async"] as const;
export type ListenerMode = (typeof ListenerModes)[number];

export type ListenerHandler<E extends Event<any, any>> = (
   event: E,
   slug: string,
) => E extends Event<any, infer R> ? MaybePromise<R | void> : never;

export class EventListener<E extends Event = Event> {
   mode: ListenerMode = "async";
   event: EventClass;
   handler: ListenerHandler<E>;
   once: boolean = false;
   id?: string;

   constructor(
      event: EventClass,
      handler: ListenerHandler<E>,
      mode: ListenerMode = "async",
      id?: string,
   ) {
      this.event = event;
      this.handler = handler;
      this.mode = mode;
      this.id = id;
   }
}
