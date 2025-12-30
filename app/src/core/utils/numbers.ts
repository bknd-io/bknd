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

export const formatNumber = {
   fileSize: (bytes: number, decimals = 2): string => {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Number.parseFloat((bytes / k ** i).toFixed(dm)) + " " + sizes[i];
   },
};
