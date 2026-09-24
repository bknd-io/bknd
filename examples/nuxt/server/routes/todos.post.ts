export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { data, action } = body;

  const api = await getApi({});
  
  switch (action) {
    case 'get': {
      const limit = 5;
      const todos = await api.data.readMany("todos", { limit, sort: "-id" });
      return { total: todos.body.meta.total, todos, limit };
    }

    case 'create': {
      return await api.data.createOne("todos", { title: data.title });
    }

    case 'delete': {
      return await api.data.deleteOne("todos", data.id);
    }

    case 'toggle': {
      return await api.data.updateOne("todos", data.id, { done: !data.done });
    }

    default: {
      return { path: action };
    }
  }

});
