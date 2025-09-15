import { v4, v7, validate, version as uuidVersion } from "uuid";

// generates v4
export function uuid(): string {
  return v4();
}

// generates v7
export function uuidv7(): string {
  return v7();
}

// validate uuid
export function uuidValidate(uuid: string, version: 4 | 7): boolean {
  return validate(uuid) && uuidVersion(uuid) === version;
}
