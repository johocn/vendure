// Check Vendure plugin metadata the same way Vendure does
const { PLUGIN_METADATA, getPluginAPIExtensions, getConfigurationFunction, getCompatibility } = require('@vendure/core/dist/plugin/plugin-metadata');

const { DeliveryPlugin } = require('@vendure/delivery-plugin');
const { CouponPlugin } = require('@vendure/coupon-plugin');

function inspectPlugin(name, plugin) {
  console.log(`\n=== ${name} ===`);
  console.log('Type:', typeof plugin);
  console.log('Is DynamicModule:', !!plugin?.module);

  const target = plugin?.module ?? plugin;
  console.log('Target:', target?.name);

  for (const [key, metaKey] of Object.entries(PLUGIN_METADATA)) {
    const val = Reflect.getMetadata(metaKey, target);
    if (val !== undefined) {
      const display = typeof val === 'function' ? '[Function]' : JSON.stringify(val, null, 2)?.substring(0, 200);
      console.log(`  ${key} (${metaKey}):`, display);
    } else {
      console.log(`  ${key} (${metaKey}): undefined`);
    }
  }

  // Check NestJS module metadata
  const MODULE_METADATA = require('@nestjs/common/constants').MODULE_METADATA;
  if (MODULE_METADATA) {
    for (const [key, metaKey] of Object.entries(MODULE_METADATA)) {
      const val = Reflect.getMetadata(metaKey, target);
      if (val !== undefined) {
        const display = Array.isArray(val) ? `[${val.map(v => v?.name ?? typeof v).join(', ')}]` : typeof val;
        console.log(`  NestJS ${key}:`, display);
      }
    }
  }
}

inspectPlugin('DeliveryPlugin', DeliveryPlugin);
inspectPlugin('DeliveryPlugin.init()', DeliveryPlugin.init());
inspectPlugin('CouponPlugin', CouponPlugin);
inspectPlugin('CouponPlugin.init()', CouponPlugin.init());
