import { describe, test, expect } from "bun:test";
import { checkMaxReached } from "./helper";

describe("media helper", () => {
   test("checkMaxReached", () => {
      expect(
         checkMaxReached({
            added: 1,
         }),
      ).toEqual({ reject: false, to_drop: 0 });
      expect(
         checkMaxReached({
            maxItems: 1,
            added: 1,
         }),
      ).toEqual({ reject: false, to_drop: 0 });
      expect(
         checkMaxReached({
            maxItems: 1,
            added: 2,
         }),
      ).toEqual({ reject: true, to_drop: 2 });
      expect(
         checkMaxReached({
            maxItems: 2,
            overwrite: true,
            added: 4,
         }),
      ).toEqual({ reject: true, to_drop: 4 });
      expect(
         checkMaxReached({
            maxItems: 2,
            current: 2,
            overwrite: true,
            added: 2,
         }),
      ).toEqual({ reject: false, to_drop: 2 });
      expect(
         checkMaxReached({
            maxItems: 6,
            current: 5,
            overwrite: true,
            added: 1,
         }),
      ).toEqual({ reject: false, to_drop: 0 });
      expect(
         checkMaxReached({
            maxItems: 6,
            current: 6,
            overwrite: true,
            added: 1,
         }),
      ).toEqual({ reject: false, to_drop: 1 });
      console.log(
         checkMaxReached({
            maxItems: 6,
            current: 0,
            overwrite: true,
            added: 1,
         }),
      );
   });
});
