import { Exception, isDebug } from "core";
import { HttpStatus } from "core/utils";

export class AuthException extends Exception {
   getSafeErrorAndCode() {
      return {
         error: "Invalid credentials",
         code: HttpStatus.UNAUTHORIZED,
      };
   }

   override toJSON(): any {
      if (isDebug()) {
         return super.toJSON();
      }

      return {
         error: this.getSafeErrorAndCode().error,
         type: "AuthException",
      };
   }
}

export class UserExistsException extends AuthException {
   override name = "UserExistsException";
   override code = HttpStatus.UNPROCESSABLE_ENTITY;

   constructor() {
      super("User already exists");
   }
}

export class UserNotFoundException extends AuthException {
   override name = "UserNotFoundException";
   override code = HttpStatus.NOT_FOUND;

   constructor() {
      super("User not found");
   }
}

export class InvalidCredentialsException extends AuthException {
   override name = "InvalidCredentialsException";
   override code = HttpStatus.UNAUTHORIZED;

   constructor() {
      super("Invalid credentials");
   }
}

export class UnableToCreateUserException extends AuthException {
   override name = "UnableToCreateUserException";
   override code = HttpStatus.INTERNAL_SERVER_ERROR;

   constructor() {
      super("Unable to create user");
   }
}

export class InvalidConditionsException extends AuthException {
   override code = HttpStatus.UNPROCESSABLE_ENTITY;

   constructor(message: string) {
      super(message ?? "Invalid conditions");
   }
}
