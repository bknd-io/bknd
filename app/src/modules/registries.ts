import { AuthStrategyRegistry } from "auth/auth-schema";
import { MediaAdapterRegistry } from "media/media-schema";

const registries = {
   media: MediaAdapterRegistry,
   auth: AuthStrategyRegistry,
} as const;

export { registries };
