/**
 * Simple external ID handler for testing import resolution
 */

export default function simpleHandler(entity: string, data?: any): string {
    const timestamp = Date.now();
    const prefix = data?.prefix || 'ID';
    return `${prefix}_${entity}_${timestamp}`;
}

export function namedHandler(entity: string, data?: any): string {
    return `NAMED_${entity}_${Date.now()}`;
}

export function asyncHandler(entity: string, data?: any): Promise<string> {
    return Promise.resolve(`ASYNC_${entity}_${Date.now()}`);
}