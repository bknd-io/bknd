import dayjs from "dayjs";
import weekOfYear from "dayjs/plugin/weekOfYear.js";

declare module "dayjs" {
   interface Dayjs {
      week(): number;
      week(value: number): dayjs.Dayjs;
   }
}

dayjs.extend(weekOfYear);

export function datetimeStringLocal(dateOrString?: string | Date | undefined): string {
   return dayjs(dateOrString).format("YYYY-MM-DD HH:mm:ss");
}

export function datetimeStringUTC(dateOrString?: string | Date | undefined): string {
   const date = dateOrString ? new Date(dateOrString) : new Date();
   return date.toISOString().replace("T", " ").split(".")[0]!;
}

export function getTimezoneOffset(): number {
   return new Date().getTimezoneOffset();
}

export function getTimezone(): string {
   return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export { dayjs };
