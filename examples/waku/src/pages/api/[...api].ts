import { getApp } from "../../bknd";

export default async function handler(request: Request) {
   return (await getApp()).fetch(request);
}
