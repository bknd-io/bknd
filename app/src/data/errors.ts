import { Exception } from "core/errors";
import { type InvalidSchemaError, HttpStatus } from "bknd/utils";
import type { Entity } from "./entities";
import type { Field } from "./fields";

export class UnableToConnectException extends Exception {
   override name = "UnableToConnectException";
   override code = HttpStatus.INTERNAL_SERVER_ERROR;
}

export class InvalidSearchParamsException extends Exception {
   override name = "InvalidSearchParamsException";
   override code = HttpStatus.UNPROCESSABLE_ENTITY;
}

export class TransformRetrieveFailedException extends Exception {
   override name = "TransformRetrieveFailedException";
   override code = HttpStatus.UNPROCESSABLE_ENTITY;
}

export class TransformPersistFailedException extends Exception {
   override name = "TransformPersistFailedException";
   override code = HttpStatus.UNPROCESSABLE_ENTITY;

   static invalidType(property: string, expected: string, given: any) {
      const givenValue = typeof given === "object" ? JSON.stringify(given) : given;
      const message =
         `Property "${property}" must be of type "${expected}", ` +
         `"${givenValue}" of type "${typeof given}" given.`;
      return new TransformPersistFailedException(message);
   }

   static required(property: string) {
      return new TransformPersistFailedException(`Property "${property}" is required`);
   }
}

export class InvalidFieldConfigException extends Exception {
   override name = "InvalidFieldConfigException";
   override code = HttpStatus.BAD_REQUEST;

   constructor(
      field: Field<any, any, any>,
      public given: any,
      error: InvalidSchemaError,
   ) {
      console.error("InvalidFieldConfigException", {
         given,
         error: error.first(),
      });
      super(`Invalid Field config given for field "${field.name}": ${error.firstToString()}`);
   }
}

export class EntityNotDefinedException extends Exception {
   override name = "EntityNotDefinedException";
   override code = HttpStatus.BAD_REQUEST;

   constructor(entity?: Entity | string) {
      if (!entity) {
         super("Cannot find an entity that is undefined");
      } else {
         super(`Entity "${typeof entity !== "string" ? entity.name : entity}" not defined`);
      }
   }
}

export class EntityNotFoundException extends Exception {
   override name = "EntityNotFoundException";
   override code = HttpStatus.NOT_FOUND;

   constructor(entity: Entity | string, id: any) {
      super(
         `Entity "${typeof entity !== "string" ? entity.name : entity}" with id "${id}" not found`,
      );
   }
}
