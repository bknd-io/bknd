export function clampNumber(value: number, min: number, max: number): number {
   const lower = Math.min(min, max);
   const upper = Math.max(min, max);
   return Math.max(lower, Math.min(value, upper));
}

export function ensureInt(value?: string | number | null | undefined): number {
   if (value === undefined || value === null) {
      return 0;
   }

   return typeof value === "number" ? value : Number.parseInt(value, 10);
}
