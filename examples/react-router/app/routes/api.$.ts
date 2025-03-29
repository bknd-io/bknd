import { getApp } from "~/bknd";

const handler = async (args: { request: Request }) => {
   const app = await getApp();
   return app.fetch(args.request);
};

export const loader = handler;
export const action = handler;
