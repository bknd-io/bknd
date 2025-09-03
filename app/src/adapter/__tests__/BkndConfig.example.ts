/**
 * Example usage of BkndConfig with custom ID handlers
 * This file demonstrates how to configure custom ID handlers in bknd.config.ts
 */

import type { BkndConfig } from '../index';

// Example 1: Global custom ID handler
export const globalHandlerConfig: BkndConfig = {
  connection: { url: ':memory:' },
  idHandlers: {
    type: 'function',
    handler: (entity: string, data?: any) => {
      // Generate a custom ID with entity prefix and timestamp
      const timestamp = Date.now();
      const suffix = data?.suffix || 'default';
      return `${entity.toUpperCase()}_${suffix}_${timestamp}`;
    },
    options: {
      includeTimestamp: true,
      prefix: 'CUSTOM'
    }
  }
};

// Example 2: Per-entity custom ID handlers
export const perEntityHandlerConfig: BkndConfig = {
  connection: { url: ':memory:' },
  idHandlers: {
    users: {
      type: 'function',
      handler: (entity: string, data?: any) => {
        // Generate user IDs with USER_ prefix
        const userId = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `USER_${userId}`;
      }
    },
    orders: {
      type: 'function',
      handler: (entity: string, data?: any) => {
        // Generate order IDs with date and sequence
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `ORD_${date}_${sequence}`;
      }
    },
    products: {
      type: 'function',
      handler: (entity: string, data?: any) => {
        // Generate product IDs based on category
        const category = data?.category || 'GEN';
        const productId = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        return `${category}_${productId}`;
      }
    }
  }
};

// Example 3: Import-based handler (will be implemented in task 10)
export const importHandlerConfig: BkndConfig = {
  connection: { url: ':memory:' },
  idHandlers: {
    type: 'import',
    importPath: './handlers/customIdGenerator',
    functionName: 'generateCustomId',
    options: {
      format: 'uuid-v7',
      prefix: 'CUSTOM'
    }
  }
};

// Example 4: Mixed configuration with app function
export const mixedConfig: BkndConfig<{ env: { NODE_ENV: string } }> = {
  app: (args) => ({
    connection: { url: args.env.NODE_ENV === 'test' ? ':memory:' : 'file:data.db' },
    initialConfig: {
      server: { cors: { origin: args.env.NODE_ENV === 'development' ? '*' : 'https://myapp.com' } }
    }
  }),
  idHandlers: {
    users: {
      type: 'function',
      handler: (entity: string) => `user_${Date.now()}`
    },
    sessions: {
      type: 'function',
      handler: () => crypto.randomUUID()
    }
  },
  beforeBuild: async (app, registries) => {
    console.log('Custom ID handlers have been registered');
    // Additional setup logic here
  },
  onBuilt: async (app) => {
    console.log('App built with custom ID handlers');
  }
};

/**
 * Usage examples:
 * 
 * 1. In your bknd.config.ts file:
 * ```typescript
 * import type { BkndConfig } from 'bknd/adapter';
 * 
 * export default {
 *   connection: { url: 'file:data.db' },
 *   idHandlers: {
 *     users: {
 *       type: 'function',
 *       handler: (entity: string) => `user_${Date.now()}`
 *     }
 *   }
 * } satisfies BkndConfig;
 * ```
 * 
 * 2. The handler will be automatically registered during app initialization
 * 3. Entities configured with custom primary field format will use these handlers
 * 4. The registry can be accessed via idHandlerRegistry.getHandler('config_users')
 */