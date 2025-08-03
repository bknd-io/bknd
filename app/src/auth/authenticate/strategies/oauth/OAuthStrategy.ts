import type { Authenticator, AuthAction } from "auth/authenticate/Authenticator";
import { type Context, Hono } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import * as oauth from "oauth4webapi";
import * as issuers from "./issuers";
import { s, filterKeys } from "bknd/utils";
import { Exception } from "core/errors";
import { isDebug } from "core/env";
import { AuthStrategy } from "../Strategy";

type ConfiguredIssuers = keyof typeof issuers;
type SupportedTypes = "oauth2" | "oidc";

type RequireKeys<T extends object, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

const schemaProvided = s.object(
   {
      name: s.string({ enum: Object.keys(issuers) as ConfiguredIssuers[] }),
      type: s.string({ enum: ["oidc", "oauth2"] as const, default: "oauth2" }),
      client: s
         .object({
            client_id: s.string(),
            client_secret: s.string(),
         })
         .strict(),
   },
   { title: "OAuth" },
);
type ProvidedOAuthConfig = s.Static<typeof schemaProvided>;

export type CustomOAuthConfig = {
   type: SupportedTypes;
   name: string;
} & IssuerConfig & {
      client: RequireKeys<
         oauth.Client,
         "client_id" | "client_secret" | "token_endpoint_auth_method"
      >;
   };

type OAuthConfig = ProvidedOAuthConfig | CustomOAuthConfig;

export type UserProfile = {
   sub: string;
   email: string;
   [key: string]: any;
};

export type IssuerConfig<UserInfo = any> = {
   type: SupportedTypes;
   client: RequireKeys<oauth.Client, "token_endpoint_auth_method">;
   as: oauth.AuthorizationServer & {
      scope_separator?: string;
   };
   profile: (
      info: UserInfo,
      config: Omit<IssuerConfig, "profile">,
      tokenResponse: any,
   ) => Promise<UserProfile>;
};

export class OAuthCallbackException extends Exception {
   override name = "OAuthCallbackException";

   constructor(
      public error: any,
      public step: string,
   ) {
      super("OAuthCallbackException on " + step);
   }
}

export class OAuthStrategy extends AuthStrategy<typeof schemaProvided> {
   constructor(config: ProvidedOAuthConfig) {
      super(config, "oauth", config.name, "external");
   }

   getSchema() {
      return schemaProvided;
   }

   getIssuerConfig(): IssuerConfig {
      return issuers[this.config.name];
   }

   async getConfig(): Promise<
      IssuerConfig & {
         client: {
            client_id: string;
            client_secret: string;
         };
      }
   > {
      const info = this.getIssuerConfig();

      if (info.type === "oidc") {
         const issuer = new URL(info.as.issuer);
         const request = await oauth.discoveryRequest(issuer);
         info.as = await oauth.processDiscoveryResponse(issuer, request);
      }

      return {
         ...info,
         type: info.type,
         client: {
            ...info.client,
            ...this.config.client,
         },
      };
   }

   async getCodeChallenge(as: oauth.AuthorizationServer, state: string, method: "S256" = "S256") {
      const challenge_supported = as.code_challenge_methods_supported?.includes(method);
      let challenge: string | undefined;
      let challenge_method: string | undefined;
      if (challenge_supported) {
         challenge = await oauth.calculatePKCECodeChallenge(state);
         challenge_method = method;
      }

      return { challenge_supported, challenge, challenge_method };
   }

   async request(options: { redirect_uri: string; state: string; scopes?: string[] }): Promise<{
      url: string;
      endpoint: string;
      params: Record<string, string>;
   }> {
      const { client, as } = await this.getConfig();

      const { challenge_supported, challenge, challenge_method } = await this.getCodeChallenge(
         as,
         options.state,
      );

      if (!as.authorization_endpoint) {
         throw new Error("authorization_endpoint is not provided");
      }

      const scopes = options.scopes ?? as.scopes_supported;
      if (!Array.isArray(scopes) || scopes.length === 0) {
         throw new Error("No scopes provided");
      }

      if (scopes.every((scope) => !as.scopes_supported?.includes(scope))) {
         throw new Error("Invalid scopes provided");
      }

      const endpoint = as.authorization_endpoint!;
      const params: any = {
         client_id: client.client_id,
         redirect_uri: options.redirect_uri,
         response_type: "code",
         scope: scopes.join(as.scope_separator ?? " "),
      };
      if (challenge_supported) {
         params.code_challenge = challenge;
         params.code_challenge_method = challenge_method;
      } else {
         params.nonce = options.state;
      }

      return {
         url: new URL(endpoint) + "?" + new URLSearchParams(params).toString(),
         endpoint,
         params,
      };
   }

   private async oidc(
      callbackParams: URL | URLSearchParams,
      options: { redirect_uri: string; state: string; scopes?: string[] },
   ) {
      const config = await this.getConfig();
      const { client, as, type } = config;

      const parameters = oauth.validateAuthResponse(
         as,
         client, // no client_secret required
         callbackParams,
         oauth.expectNoState,
      );
      if (oauth.isOAuth2Error(parameters)) {
         throw new OAuthCallbackException(parameters, "validateAuthResponse");
      }

      const response = await oauth.authorizationCodeGrantRequest(
         as,
         client,
         parameters,
         options.redirect_uri,
         options.state,
      );

      const challenges = oauth.parseWwwAuthenticateChallenges(response);
      if (challenges) {
         // @todo: Handle www-authenticate challenges as needed
         throw new OAuthCallbackException(challenges, "www-authenticate");
      }

      const { challenge_supported, challenge } = await this.getCodeChallenge(as, options.state);

      const expectedNonce = challenge_supported ? undefined : challenge;
      const result = await oauth.processAuthorizationCodeOpenIDResponse(
         as,
         client,
         response,
         expectedNonce,
      );
      if (oauth.isOAuth2Error(result)) {
         // @todo: Handle OAuth 2.0 response body error
         throw new OAuthCallbackException(result, "processAuthorizationCodeOpenIDResponse");
      }

      const claims = oauth.getValidatedIdTokenClaims(result);
      const infoRequest = await oauth.userInfoRequest(as, client, result.access_token!);
      const resultUser = await oauth.processUserInfoResponse(as, client, claims.sub, infoRequest);

      return await config.profile(resultUser, config, claims); // @todo: check claims
   }

   private async oauth2(
      callbackParams: URL | URLSearchParams,
      options: { redirect_uri: string; state: string; scopes?: string[] },
   ) {
      const config = await this.getConfig();
      const { client, type, as, profile } = config;

      const parameters = oauth.validateAuthResponse(
         as,
         client, // no client_secret required
         callbackParams,
         oauth.expectNoState,
      );
      if (oauth.isOAuth2Error(parameters)) {
         throw new OAuthCallbackException(parameters, "validateAuthResponse");
      }

      const response = await oauth.authorizationCodeGrantRequest(
         as,
         client,
         parameters,
         options.redirect_uri,
         options.state,
      );

      const challenges = oauth.parseWwwAuthenticateChallenges(response);
      if (challenges) {
         // @todo: Handle www-authenticate challenges as needed
         throw new OAuthCallbackException(challenges, "www-authenticate");
      }

      // slack does not return valid "token_type"...
      const copy = response.clone();
      let result: any = {};
      try {
         result = await oauth.processAuthorizationCodeOAuth2Response(as, client, response);
         if (oauth.isOAuth2Error(result)) {
            throw new Error(); // Handle OAuth 2.0 response body error
         }
      } catch (e) {
         result = (await copy.json()) as any;
      }

      const res2 = await oauth.userInfoRequest(as, client, result.access_token!);
      const user = await res2.json();

      return await config.profile(user, config, result);
   }

   async callback(
      callbackParams: URL | URLSearchParams,
      options: { redirect_uri: string; state: string; scopes?: string[] },
   ): Promise<UserProfile> {
      const type = this.getIssuerConfig().type;

      switch (type) {
         case "oidc":
            return await this.oidc(callbackParams, options);
         case "oauth2":
            return await this.oauth2(callbackParams, options);
         default:
            throw new Error("Unsupported type");
      }
   }

   getController(auth: Authenticator): Hono<any> {
      const hono = new Hono();
      const secret = "secret";
      const cookie_name = "_challenge";

      type TState = {
         state: string;
         action: AuthAction;
         redirect?: string;
         mode: "token" | "cookie";
      };

      const setState = async (c: Context, config: TState): Promise<void> => {
         await setSignedCookie(c, cookie_name, JSON.stringify(config), secret, {
            secure: true,
            httpOnly: true,
            sameSite: "Lax",
            maxAge: 60 * 5, // 5 minutes
         });
      };

      const getState = async (c: Context): Promise<TState> => {
         if (c.req.header("X-State-Challenge")) {
            return {
               state: c.req.header("X-State-Challenge"),
               action: c.req.header("X-State-Action"),
               mode: "token",
            } as any;
         }

         const value = await getSignedCookie(c, secret, cookie_name);
         try {
            return JSON.parse(value as string);
         } catch (e) {
            throw new Error("Invalid state");
         }
      };

      hono.get("/callback", async (c) => {
         const url = new URL(c.req.url);
         const params = new URLSearchParams(url.search);

         const state = await getState(c);

         // @todo: add config option to determine if state.action is allowed
         const redirect_uri =
            state.mode === "cookie"
               ? url.origin + url.pathname
               : url.origin + url.pathname.replace("/callback", "/token");

         const profile = await this.callback(params, {
            redirect_uri,
            state: state.state,
         });

         const safeProfile = {
            email: profile.email,
            strategy_value: profile.sub,
         } as const;

         const verify = async (user) => {
            if (user.strategy_value !== profile.sub) {
               throw new Exception("Invalid credentials");
            }
         };
         const opts = {
            redirect: state.redirect,
            forceJsonResponse: state.mode !== "cookie",
         } as const;

         switch (state.action) {
            case "login":
               return auth.resolveLogin(c, this, safeProfile, verify, opts);
            case "register":
               return auth.resolveRegister(c, this, safeProfile, verify, opts);
            default:
               throw new Error("Invalid action");
         }
      });

      hono.get("/token", async (c) => {
         const url = new URL(c.req.url);
         const params = new URLSearchParams(url.search);

         return c.json({
            code: params.get("code") ?? null,
         });
      });

      hono.post("/:action", async (c) => {
         const action = c.req.param("action") as AuthAction;
         if (!["login", "register"].includes(action)) {
            return c.notFound();
         }

         const url = new URL(c.req.url);
         const path = url.pathname.replace(`/${action}`, "");
         const redirect_uri = url.origin + path + "/callback";
         const referer = new URL(c.req.header("Referer") ?? "/");

         const state = oauth.generateRandomCodeVerifier();
         const response = await this.request({
            redirect_uri,
            state,
         });

         await setState(c, { state, action, redirect: referer.toString(), mode: "cookie" });

         return c.redirect(response.url);
      });

      hono.get("/:action", async (c) => {
         const action = c.req.param("action") as AuthAction;
         if (!["login", "register"].includes(action)) {
            return c.notFound();
         }

         const url = new URL(c.req.url);
         const path = url.pathname.replace(`/${action}`, "");
         const redirect_uri = url.origin + path + "/token";

         const state = oauth.generateRandomCodeVerifier();
         const response = await this.request({
            redirect_uri,
            state,
         });

         if (isDebug()) {
            return c.json({
               url: response.url,
               redirect_uri,
               challenge: state,
               action,
               params: response.params,
            });
         }

         return c.json({
            url: response.url,
            challenge: state,
            action,
         });
      });

      return hono;
   }

   override toJSON(secrets?: boolean) {
      const config = secrets ? this.config : filterKeys(this.config, ["secret", "client_id"]);

      return {
         ...super.toJSON(secrets),
         config: {
            ...config,
            type: this.getIssuerConfig().type,
         },
      };
   }
}
