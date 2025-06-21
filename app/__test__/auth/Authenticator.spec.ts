import { describe, expect, test } from "bun:test";
import { Authenticator, type User, type UserPool } from "../../src/auth";
import { cookieConfig } from "../../src/auth/authenticate/Authenticator";
import { PasswordStrategy } from "../../src/auth/authenticate/strategies/PasswordStrategy";
import { parse } from "core/object/schema";

/*class MemoryUserPool implements UserPool {
   constructor(private users: User[] = []) {}

   async findBy(prop: "id" | "email" | "username", value: string | number) {
      return this.users.find((user) => user[prop] === value);
   }

   async create(user: Pick<User, "email" | "password">) {
      const id = this.users.length + 1;
      const newUser = { ...user, id, username: user.email };
      this.users.push(newUser);
      return newUser;
   }
}*/

describe("Authenticator", async () => {
   test("cookie options", async () => {
      console.log("parsed", parse(cookieConfig, undefined));
      console.log(cookieConfig.template({}));
   });
   /*const userpool = new MemoryUserPool([
      { id: 1, email: "d", username: "test", password: await hash.sha256("test") },
   ]);

   test("sha256 login", async () => {
      const auth = new Authenticator(userpool, {
         password: new PasswordStrategy({
            hashing: "sha256",
         }),
      });

      const { token } = await auth.login("password", { email: "d", password: "test" });
      expect(token).toBeDefined();

      const { iat, ...decoded } = decodeJwt<any>(token);
      expect(decoded).toEqual({ id: 1, email: "d", username: "test" });
      expect(await auth.verify(token)).toBe(true);
   });*/
});
