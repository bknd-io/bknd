import type { PageServerLoad } from "./$types";
import { getApp } from "bknd/adapter/sveltekit";
import { env } from "$env/dynamic/private";
import config from "../../bknd.config";

export const load: PageServerLoad = async () => {
  const app = await getApp(config, env);
  const api = app.getApi();

  const todos = await api.data.readMany("todos");

  return {
    todos: todos.data ?? [],
  };
};
