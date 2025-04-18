export class DebugLogger {
   public _context: string[] = [];
   _enabled: boolean = true;
   private readonly id = Math.random().toString(36).substr(2, 9);
   private last: number = 0;

   constructor(enabled: boolean = true) {
      this._enabled = enabled;
   }

   context(context: string) {
      this._context.push(context);
      return this;
   }

   clear() {
      this._context.pop();
      return this;
   }

   reset() {
      this.last = 0;
      return this;
   }

   log(...args: any[]) {
      if (!this._enabled) return this;

      const now = performance.now();
      const time = this.last === 0 ? 0 : Number.parseInt(String(now - this.last));
      const indents = "  ".repeat(Math.max(this._context.length - 1, 0));
      const context =
         this._context.length > 0 ? `[${this._context[this._context.length - 1]}]` : "";

      // biome-ignore lint/suspicious/noConsoleLog: <explanation>
      console.log(indents, context, time, ...args);

      this.last = now;
      return this;
   }
}
