import { v4, v7 } from "uuid";

// generates v4
export function uuid(): string {
   return v4();
}

export function uuidv7(): string {
   return v7();
}
