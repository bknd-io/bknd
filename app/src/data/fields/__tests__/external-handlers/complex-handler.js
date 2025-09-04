/**
 * CommonJS external ID handler for testing import resolution
 */

function complexHandler(entity, data) {
    const options = data || {};
    const separator = options.separator || '-';
    const includeRandom = options.includeRandom !== false;
    
    let id = entity.toUpperCase();
    
    if (includeRandom) {
        const random = Math.floor(Math.random() * 10000);
        id += `${separator}${random}`;
    }
    
    id += `${separator}${Date.now()}`;
    
    return id;
}

// Export both as CommonJS and ES module for compatibility
module.exports = complexHandler;
module.exports.default = complexHandler;
module.exports.complexHandler = complexHandler;