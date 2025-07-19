"use server";

import { getContext } from "waku/middleware/context";
import { getApi } from "../../bknd";

export { unstable_rerenderRoute as rerender } from "waku/router/server";

export function context() {
   return getContext();
}

export function handlerReq() {
   return getContext().req;
}

export function headers() {
   const context = getContext();
   return new Headers(context.req.headers);
}

export async function getUserApi(opts?: { verify?: boolean }) {
   return await getApi({
      headers: headers(),
      verify: !!opts?.verify,
   });
}
