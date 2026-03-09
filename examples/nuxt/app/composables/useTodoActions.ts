import type { DB } from "bknd";

type Todo = DB["todos"];

export const useTodoActions = () => {
  const fetchTodos = () =>
    $fetch<{ limit: number; todos: Array<Todo>; total: number }>("/todos", {
      method: "POST",
      body: { action: "get" },
    });

  const createTodo = (title: string) =>
    $fetch("/todos", {
      method: "POST",
      body: { action: "create", data: { title } },
    });

  const deleteTodo = (todo: Todo) =>
    $fetch("/todos", {
      method: "POST",
      body: { action: "delete", data: { id: todo.id } },
    });

  const toggleTodo = (todo: Todo) =>
    $fetch("/todos", {
      method: "POST",
      body: { action: "toggle", data: todo },
    });

  return { fetchTodos, createTodo, deleteTodo, toggleTodo };
};
