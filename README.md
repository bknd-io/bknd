[![npm version](https://img.shields.io/npm/v/bknd.svg)](https://npmjs.org/package/bknd)

![bknd](https://raw.githubusercontent.com/bknd-io/bknd/refs/heads/main/docs/_assets/poster.png)

<p align="center" width="100%">
<a href="https://stackblitz.com/github/bknd-io/bknd-examples?hideExplorer=1&embed=1&view=preview&startScript=example-admin-rich&initialPath=%2Fdata%2Fschema" target="_blank">
<strong>⭐ Live Demo</strong>
</a>
</p>

bknd simplifies app development by providing a fully functional backend for database management, authentication, media and workflows. Being lightweight and built on Web Standards, it can be deployed nearly anywhere, including running inside your framework of choice. No more deploying multiple separate services!

**For documentation and examples, please visit https://docs.bknd.io.**

> [!WARNING]
> Please keep in mind that **bknd** is still under active development
> and therefore full backward compatibility is not guaranteed before reaching v1.0.0.

## Size
![gzipped size of bknd](https://img.shields.io/bundlejs/size/bknd?label=bknd)
![gzipped size of bknd/client](https://img.badgesize.io/https://unpkg.com/bknd@latest/dist/ui/client/index.js?compression=gzip&label=bknd/client)
![gzipped size of bknd/elements](https://img.badgesize.io/https://unpkg.com/bknd@latest/dist/ui/elements/index.js?compression=gzip&label=bknd/elements)
![gzipped size of bknd/ui](https://img.badgesize.io/https://unpkg.com/bknd@latest/dist/ui/index.js?compression=gzip&label=bknd/ui)

The size on npm is misleading, as the `bknd` package includes the backend, the ui components as well as the whole backend bundled into the cli including static assets. 

Depending on what you use, the size can be higher as additional dependencies are getting pulled in. The minimal size of a full `bknd` app as an API is around 300 kB gzipped (e.g. deployed as Cloudflare Worker).

## Motivation
Creating digital products always requires developing both the backend (the logic) and the frontend (the appearance). Building a backend from scratch demands deep knowledge in areas such as authentication and database management. Using a backend framework can speed up initial development, but it still requires ongoing effort to work within its constraints (e.g., *"how to do X with Y?"*), which can quickly slow you down. Choosing a backend system is a tough decision, as you might not be aware of its limitations until you encounter them.

**The solution:** A backend system that only assumes and implements primitive details, integrates into multiple environments, and adheres to industry standards.

## Features
* ⚡ Instant backend with full REST API:
  * **Data**: Define, query, and control your data with ease.
  * **Auth**: Easily implement reliable authentication strategies.
  * **Media**: Effortlessly manage and serve all your media files.
  * **Flows**: Design and run workflows with seamless automation. (UI integration coming soon!)
* 🌐 Built on Web Standards for maximum compatibility
* 🏃‍♂️ Multiple run modes
  * standalone using the CLI
  * using a JavaScript runtime (Node, Bun, workerd)
  * using a React framework (Next.js, React Router, Astro)
* 📦 Official API and React SDK with type-safety
* ⚛️ React elements for auto-configured authentication and media components

## Structure
The package is mainly split into 4 parts, each serving a specific purpose:

| Import                      | Purpose                                              |
|-----------------------------|------------------------------------------------------|
| `bknd`<br/>`bknd/adapter/*` | Backend including APIs and adapters                  |
| `bknd/ui`                   | Admin UI components for react frameworks             |
| `bknd/client`               | TypeScript SDK and React hooks for the API endpoints |
| `bknd/elements`             | React components for authentication and media        |


### The backend (`bknd`)
Serve the backend as an API for any JS runtime or framework. The latter is especially handy, as it allows you to deploy your frontend and backend bundled together. Furthermore it allows adding additional logic in a way you're already familar with. Just add another route and you're good to go.

Here is an example of serving the API using node:
```js index.js
import { serve } from "bknd/adapter/node"
serve();
```

### Integrated admin UI (`bknd/ui`)
The admin UI allows to manage your data including full configuration of your backend using a graphical user interface. Using `vite`, your admin route looks like this:
```tsx
import { Admin } from "bknd/ui"
import "bknd/dist/styles.css";

export default function AdminPage() {
   return <Admin />
}
```

### Using the REST API or TypeScript SDK (`bknd/client`)
If you're not using a JavaScript environment, you can still access any endpoint using the REST API:
```bash
curl -XGET <your-endpoint>/api/data/entity/<entity>
{
  "data": [
    { "id": 1, ... },
    { "id": 2, ... }
  ],
  "meta": { /* ... */ }
}
```

In a JavaScript environment, you can use the TypeScript SDK with type-safety. The above example would look like this:
```ts
import { Api } from "bknd/client";

const api = new Api({ host: "<endpoint>" });
const { data } = await api.data.readMany("<entity>");
```

If you're using React, there are 2 hooks exposed (`useApi`, `useEntity`), as well as an `swr` wrapper around each (`useApiQuery`, `useEntityQuery`). The `swr` wrapped hooks automatically handled query invalidation:

```tsx
import { useState } from "react";
import { useEntityQuery } from "bknd/client";

export default function App() {
   const { data } = useEntityQuery("todos");   
   return <ul>
      {data?.map(todo => (
         <li key={todo.id}>{todo.name}</li>
      ))}
   </ul>
}
```

### React elements (`bknd/elements`)
You don't have to figure out API details to include media uploads to your app. For an user avatar upload, this is all you need:
```tsx
import { Media } from "bknd/elements"
import "bknd/dist/main.css"

export function UserAvatar() {
   return <Media.Dropzone
     entity={{ name: "users", id: 1, field: "avatar" }}
     maxItems={1}
     overwrite
   />
}
```
The import path also exports components for login and registration forms which are automatically pointed to the `bknd` defaults.


## 🚀 Quick start
To quickly spin up an instance, run:
```bash
npx bknd run
```

### Installation  
```bash
npm install bknd
```
