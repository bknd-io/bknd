import type { PageServerLoad } from "./$types";
import { getApp } from "bknd/adapter/sveltekit";
import config from "../../bknd.config";

export const load: PageServerLoad = async () => {
  const app = await getApp(config);
  const api = app.getApi();

  const todos = await api.data.readMany("todos");

  return {
    todos: todos.data ?? [],
  };
};
