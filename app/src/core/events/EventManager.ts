import { type Event, type EventClass, InvalidEventReturn } from "./Event";
import { EventListener, type ListenerHandler, type ListenerMode } from "./EventListener";
import { $console } from "core/utils";

export type RegisterListenerConfig =
   | ListenerMode
   | {
        mode?: ListenerMode;
        once?: boolean;
        id?: string;
     };

export interface EmitsEvents {
   emgr: EventManager;
}

// for compatibility, moved it to Event.ts
export type { EventClass };

export class EventManager<
   RegisteredEvents extends Record<string, EventClass> = Record<string, EventClass>,
> {
   protected events: EventClass[] = [];
   protected listeners: EventListener[] = [];
   enabled: boolean = true;
   protected asyncs: (() => Promise<void>)[] = [];

   constructor(
      events?: RegisteredEvents,
      private options?: {
         listeners?: EventListener[];
         onError?: (event: Event, e: unknown) => void;
         onInvalidReturn?: (event: Event, e: InvalidEventReturn) => void;
      },
   ) {
      if (events) {
         this.registerEvents(events);
      }

      options?.listeners?.forEach((l) => this.addListener(l));
   }

   enable() {
      this.enabled = true;
      return this;
   }

   disable() {
      this.enabled = false;
      return this;
   }

   clearEvents() {
      this.events = [];
      return this;
   }

   clearAll() {
      this.clearEvents();
      this.listeners = [];
      return this;
   }

   getListeners(): EventListener[] {
      return [...this.listeners];
   }

   get Events(): { [K in keyof RegisteredEvents]: RegisteredEvents[K] } {
      // proxy class to access events
      return new Proxy(this, {
         get: (_, prop: string) => {
            return this.events.find((e) => e.slug === prop);
         },
      }) as any;
   }

   eventExists(slug: string): boolean;
   eventExists(event: EventClass | Event): boolean;
   eventExists(eventOrSlug: EventClass | Event | string): boolean {
      let slug: string;

      if (typeof eventOrSlug === "string") {
         slug = eventOrSlug;
      } else {
         // @ts-expect-error
         slug = eventOrSlug.constructor?.slug ?? eventOrSlug.slug;
      }

      return !!this.events.find((e) => slug === e.slug);
   }

   protected throwIfEventNotRegistered(event: EventClass | Event | string) {
      if (!this.eventExists(event as any)) {
         // @ts-expect-error
         const name = event.constructor?.slug ?? event.slug ?? event;
         throw new Error(`Event "${name}" not registered`);
      }
   }

   registerEvent(event: EventClass, silent: boolean = false) {
      if (this.eventExists(event)) {
         if (silent) {
            return this;
         }

         throw new Error(`Event "${event.name}" already registered.`);
      }

      this.events.push(event);
      return this;
   }

   registerEvents(eventObjects: Record<string, EventClass>): this;
   registerEvents(eventArray: EventClass[]): this;
   registerEvents(objectOrArray: Record<string, EventClass> | EventClass[]): this {
      const events =
         typeof objectOrArray === "object" ? Object.values(objectOrArray) : objectOrArray;
      events.forEach((event) => this.registerEvent(event, true));
      return this;
   }

   addListener(listener: EventListener) {
      this.throwIfEventNotRegistered(listener.event);

      if (listener.id) {
         const existing = this.listeners.find((l) => l.id === listener.id);
         if (existing) {
            $console.debug(`Listener with id "${listener.id}" already exists.`);
            return this;
         }
      }

      this.listeners.push(listener);
      return this;
   }

   protected createEventListener(
      _event: EventClass | string,
      handler: ListenerHandler<any>,
      _config: RegisterListenerConfig = "async",
   ) {
      const event =
         typeof _event === "string" ? this.events.find((e) => e.slug === _event)! : _event;
      const config = typeof _config === "string" ? { mode: _config } : _config;
      const listener = new EventListener(event, handler, config.mode);
      if (config.once) {
         listener.once = true;
      }
      if (config.id) {
         listener.id = `${event.slug}-${config.id}`;
      }
      this.addListener(listener as any);
   }

   onEvent<ActualEvent extends EventClass, Instance extends InstanceType<ActualEvent>>(
      event: ActualEvent,
      handler: ListenerHandler<Instance>,
      config?: RegisterListenerConfig,
   ) {
      this.createEventListener(event, handler, config);
   }

   on<Params = any>(
      slug: string,
      handler: ListenerHandler<Event<Params>>,
      config?: RegisterListenerConfig,
   ) {
      this.createEventListener(slug, handler, config);
   }

   onAny(handler: ListenerHandler<Event<unknown>>, config?: RegisterListenerConfig) {
      this.events.forEach((event) => this.onEvent(event, handler, config));
   }

   protected collectAsyncs(promises: (() => Promise<void>)[]) {
      this.asyncs.push(...promises);
   }

   async executeAsyncs(executor: typeof Promise.all = (e) => Promise.all(e)): Promise<void> {
      if (this.asyncs.length === 0) return;
      const asyncs = [...this.asyncs];
      this.asyncs = [];
      await executor(asyncs.map((p) => p()));
   }

   async emit<Actual extends Event<any, any>>(event: Actual): Promise<Actual> {
      // @ts-expect-error slug is static
      const slug = event.constructor.slug;
      if (!this.enabled) {
         $console.debug("EventManager disabled, not emitting", slug);
         return event;
      }

      if (!this.eventExists(event)) {
         throw new Error(`Event "${slug}" not registered`);
      }

      const syncs: EventListener[] = [];
      const asyncs: (() => Promise<void>)[] = [];

      this.listeners = this.listeners.filter((listener) => {
         // if no match, keep and ignore
         if (listener.event.slug !== slug) return true;

         if (listener.mode === "sync") {
            syncs.push(listener);
         } else {
            asyncs.push(async () => await listener.handler(event, listener.event.slug));
         }
         // Remove if `once` is true, otherwise keep
         return !listener.once;
      });

      // collect asyncs
      this.collectAsyncs(asyncs);

      // execute syncs
      let _event: Actual = event;
      for (const listener of syncs) {
         try {
            const return_value = (await listener.handler(_event, listener.event.slug)) as any;

            if (typeof return_value !== "undefined") {
               const newEvent = _event.validate(return_value);
               // @ts-expect-error slug is static
               if (newEvent && newEvent.constructor.slug === slug) {
                  if (!newEvent.returned) {
                     throw new Error(
                        // @ts-expect-error slug is static
                        `Returned event ${newEvent.constructor.slug} must be marked as returned.`,
                     );
                  }
                  _event = newEvent as Actual;
               }
            }
         } catch (e) {
            if (e instanceof InvalidEventReturn) {
               this.options?.onInvalidReturn?.(_event, e);
               $console.warn(`Invalid return of event listener for "${slug}": ${e.message}`);
            } else if (this.options?.onError) {
               this.options.onError(_event, e);
            } else {
               throw e;
            }
         }
      }

      return _event;
   }
}
