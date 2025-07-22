"use client";

import { useEffect } from "react";

export default function Test() {
   useEffect(() => {
      bridge();
   }, []);
   return null;
}

async function bridge() {
   const aud = new URLSearchParams(location.search).get("aud") || "";
   // 1. Verify the user still has an auth cookie
   const me = await fetch("/api/auth/me", { credentials: "include" });
   console.log("sso-bridge:me", me);
   if (!me.ok) {
      console.log("sso-bridge:no session");
      parent.postMessage({ type: "NOSESSION" }, aud);
   } else {
      console.log("sso-bridge:session");

      // 2. Get short-lived JWT (internal endpoint, same origin)
      const res = await fetch("/api/issue-jwt", {
         credentials: "include",
         headers: { "Content-Type": "application/json" },
         method: "POST",
         body: JSON.stringify({
            aud,
         }),
      });
      console.log("sso-bridge:res", res);
      const { jwt, exp } = (await res.json()) as any; // exp = unix timestamp seconds
      console.log("sso-bridge:jwt", { jwt, exp });

      // 3. Send token up
      parent.postMessage({ type: "JWT", jwt, exp }, aud);

      // 4. Listen for refresh requests
      window.addEventListener("message", async (ev) => {
         console.log("sso-bridge:message", ev);
         if (ev.origin !== aud) return;
         if (ev.data !== "REFRESH") return;
         console.log("sso-bridge:message:refresh");

         const r = await fetch("/api/issue-jwt", {
            credentials: "include",
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ aud: ev.origin }),
         });
         console.log("sso-bridge:message:r", r);
         const { jwt, exp } = (await r.json()) as any;
         console.log("sso-bridge:message:jwt", { jwt, exp });
         parent.postMessage({ type: "JWT", jwt, exp }, ev.origin);
      });
   }
}
