// Quick test: load dev-config and check plugins array
const path = require('path');
process.env.TS_NODE_CACHE = 'false';

require('ts-node/register');
require('dotenv/config');
require('tsconfig-paths/register');

const config = require('./dev-config.ts');
console.log('\n=== PLUGINS ARRAY ===');
console.log('Plugins count:', config.devConfig.plugins.length);
config.devConfig.plugins.forEach((p, i) => {
    const name = typeof p === 'function' ? p.name : (p?.module?.name ?? 'unknown');
    console.log(`  [${i}]: ${name} (type: ${typeof p})`);
});

const deliveryIdx = config.devConfig.plugins.findIndex(p => {
    const name = typeof p === 'function' ? p.name : (p?.module?.name ?? '');
    return name === 'DeliveryPlugin';
});
console.log('\nDeliveryPlugin index:', deliveryIdx);
if (deliveryIdx >= 0) {
    const dp = config.devConfig.plugins[deliveryIdx];
    console.log('DeliveryPlugin in array:', typeof dp, dp?.name);
}
