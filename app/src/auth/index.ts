export { UserExistsException, UserNotFoundException, InvalidCredentialsException } from "./errors";
export {
   type ProfileExchange,
   type Strategy,
   type User,
   type SafeUser,
   type CreateUser,
   type AuthResponse,
   type UserPool,
   type AuthAction,
   type AuthUserResolver,
   Authenticator,
   authenticatorConfig,
   jwtConfig,
} from "./authenticate/Authenticator";

export { AppAuth, type UserFieldSchema } from "./AppAuth";

export { Guard, type GuardUserContext, type GuardConfig } from "./authorize/Guard";
export { Role } from "./authorize/Role";

export * as AuthPermissions from "./auth-permissions";
