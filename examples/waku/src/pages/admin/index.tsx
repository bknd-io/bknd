import { unstable_redirect as redirect } from "waku/router/server";

export default async function AdminIndex() {
   await new Promise((resolve) => setTimeout(resolve, 100));
   redirect("/admin/data");
}
