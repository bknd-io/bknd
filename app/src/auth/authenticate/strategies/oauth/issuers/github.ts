import type { IssuerConfig } from "../OAuthStrategy";

type GithubUserInfo = {
   id: number;
   sub: string;
   name: string;
   email: null;
   avatar_url: string;
};

type GithubUserEmailResponse = {
   email: string;
   primary: boolean;
   verified: boolean;
   visibility: string;
}[];

export const github: IssuerConfig<GithubUserInfo> = {
   type: "oauth2",
   client: {
      token_endpoint_auth_method: "client_secret_basic",
   },
   as: {
      code_challenge_methods_supported: ["S256"],
      issuer: "https://github.com",
      scopes_supported: ["read:user", "user:email"],
      scope_separator: " ",
      authorization_endpoint: "https://github.com/login/oauth/authorize",
      token_endpoint: "https://github.com/login/oauth/access_token",
      userinfo_endpoint: "https://api.github.com/user",
   },
   profile: async (
      info: GithubUserInfo,
      config: Omit<IssuerConfig, "profile">,
      tokenResponse: any,
   ) => {
      try {
         const res = await fetch("https://api.github.com/user/emails", {
            headers: {
               "User-Agent": "bknd", // this is mandatory... *smh*
               Accept: "application/json",
               Authorization: `Bearer ${tokenResponse.access_token}`,
            },
         });
         const data = (await res.json()) as GithubUserEmailResponse;
         const email = data.find((e: any) => e.primary)?.email;
         if (!email) {
            throw new Error("No primary email found");
         }

         return {
            ...info,
            sub: String(info.id),
            email: email,
         };
      } catch (e) {
         throw new Error("Couldn't retrive github email");
      }
   },
};
