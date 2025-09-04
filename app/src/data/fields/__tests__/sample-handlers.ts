import { idHandlerRegistry, type IdHandler } from '../IdHandlerRegistry';

/**
 * Sample custom ID handlers for demonstration and testing
 */

// Prefixed ID handler
const prefixedIdHandler: IdHandler = {
    id: 'prefixed-id',
    name: 'Prefixed ID Generator',
    description: 'Generates IDs with a custom prefix and timestamp',
    handler: (entity: string, data?: any) => {
        const prefix = data?.prefix || entity.toUpperCase();
        const timestamp = Date.now();
        return `${prefix}-${timestamp}`;
    },
    validate: (config: any) => {
        if (config.prefix && typeof config.prefix !== 'string') {
            return 'Prefix must be a string';
        }
        if (config.prefix && config.prefix.length > 10) {
            return 'Prefix must be 10 characters or less';
        }
        return true;
    }
};

// Sequential ID handler
let sequentialCounters = new Map<string, number>();

const sequentialIdHandler: IdHandler = {
    id: 'sequential-id',
    name: 'Sequential ID Generator',
    description: 'Generates sequential IDs with optional padding',
    handler: (entity: string, data?: any) => {
        const current = sequentialCounters.get(entity) || 0;
        const next = current + 1;
        sequentialCounters.set(entity, next);

        const padding = data?.padding || 4;
        return next.toString().padStart(padding, '0');
    },
    validate: (config: any) => {
        if (config.padding && (typeof config.padding !== 'number' || config.padding < 1)) {
            return 'Padding must be a positive number';
        }
        return true;
    }
};

// UUID with prefix handler
const uuidWithPrefixHandler: IdHandler = {
    id: 'uuid-with-prefix',
    name: 'UUID with Prefix',
    description: 'Generates UUIDs with a custom prefix',
    handler: async (entity: string, data?: any) => {
        const { uuidv7 } = await import('bknd/utils');
        const prefix = data?.prefix || entity.slice(0, 3).toUpperCase();
        const uuid = uuidv7();
        return `${prefix}_${uuid}`;
    },
    validate: (config: any) => {
        if (config.prefix && typeof config.prefix !== 'string') {
            return 'Prefix must be a string';
        }
        return true;
    }
};

/**
 * Register sample handlers for testing and demonstration
 */
export function registerSampleHandlers() {
    try {
        idHandlerRegistry.register('prefixed-id', prefixedIdHandler);
        idHandlerRegistry.register('sequential-id', sequentialIdHandler);
        idHandlerRegistry.register('uuid-with-prefix', uuidWithPrefixHandler);
        console.log('Sample ID handlers registered successfully');
    } catch (error) {
        console.warn('Some sample handlers may already be registered:', error);
    }
}

/**
 * Clear sample handlers (for testing)
 */
export function clearSampleHandlers() {
    idHandlerRegistry.clear();
    // Reset sequential counters
    sequentialCounters.clear();
}

export {
    prefixedIdHandler,
    sequentialIdHandler,
    uuidWithPrefixHandler
};