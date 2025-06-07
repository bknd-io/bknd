# Postgres adapter for `bknd` (experimental)
This packages adds an adapter to use a Postgres database with [`bknd`](https://github.com/bknd-io/bknd). It works with both `pg` and `postgres` drivers, and supports custom postgres connections.
* works with any Postgres database (tested with Supabase, Neon, Xata, and RDS)
* choose between `pg` and `postgres` drivers
* create custom postgres connections with any kysely postgres dialect

## Installation
Install the adapter with:
```bash
npm install @bknd/postgres
```

## Using `pg` driver
Install the [`pg`](https://github.com/brianc/node-postgres) driver with:
```bash
npm install pg
```

Create a connection:

```ts
import { pg } from "@bknd/postgres";

// accepts `pg` configuration
const connection = pg({
   host: "localhost",
   port: 5432,
   user: "postgres",
   password: "postgres",
   database: "postgres",
});

// or with a connection string
const connection = pg({
   connectionString: "postgres://postgres:postgres@localhost:5432/postgres",
});
```

## Using `postgres` driver

Install the [`postgres`](https://github.com/porsager/postgres) driver with:
```bash
npm install postgres
```

Create a connection:

```ts
import { postgresJs } from "@bknd/postgres";

// accepts `postgres` configuration
const connection = postgresJs("postgres://postgres:postgres@localhost:5432/postgres");
```

## Using custom postgres dialects

You can create a custom kysely postgres dialect by using the `createCustomPostgresConnection` function.

```ts
import { createCustomPostgresConnection } from "@bknd/postgres";

const connection = createCustomPostgresConnection(MyDialect)({
   // your custom dialect configuration
   supports: {
      batching: true
   },
   excludeTables: ["my_table"],
   plugins: [new MyKyselyPlugin()],
});
```

### Custom `neon` connection

```typescript
import { createCustomPostgresConnection } from "@bknd/postgres";
import { NeonDialect } from "kysely-neon";

const connection = createCustomPostgresConnection(NeonDialect)({
   connectionString: process.env.NEON,
});
```

### Custom `xata` connection

```typescript
import { createCustomPostgresConnection } from "@bknd/postgres";
import { XataDialect } from "@xata.io/kysely";
import { buildClient } from "@xata.io/client";

const client = buildClient();
const xata = new client({
   databaseURL: process.env.XATA_URL,
   apiKey: process.env.XATA_API_KEY,
   branch: process.env.XATA_BRANCH,
});

const connection = createCustomPostgresConnection(XataDialect, {
   supports: {
      batching: false,
   },
})({ xata });
```