// 直接测试 DeliveryPlugin 的 metadata 是否正确
const { PLUGIN_METADATA } = require('@vendure/core/dist/plugin/plugin-metadata');
const { DeliveryPlugin } = require('@vendure/delivery-plugin');
const { CouponPlugin } = require('@vendure/coupon-plugin');

function inspectPlugin(name, plugin) {
  console.log(`\n=== ${name} ===`);
  console.log('Type:', typeof plugin);
  console.log('Is function:', typeof plugin === 'function');
  console.log('Name:', plugin?.name);

  // 检查是否是动态模块
  const isDynamic = !!plugin?.module;
  console.log('Is DynamicModule:', isDynamic);

  const target = isDynamic ? plugin.module : plugin;
  console.log('Target:', target?.name);

  if (!target) {
    console.log('No target found!');
    return;
  }

  for (const [key, metaKey] of Object.entries(PLUGIN_METADATA)) {
    const val = Reflect.getMetadata(metaKey, target);
    console.log(`  ${key} (${metaKey}):`, val !== undefined ? typeof val : 'undefined');
  }

  // 检查模块装饰器元数据
  const MODULE_METADATA = require('@nestjs/common/constants').MODULE_METADATA;
  for (const [key, metaKey] of Object.entries(MODULE_METADATA)) {
    const val = Reflect.getMetadata(metaKey, target);
    if (Array.isArray(val)) {
      console.log(`  NestJS ${key}: [${val.length} items]`);
    } else {
      console.log(`  NestJS ${key}:`, val !== undefined ? typeof val : 'undefined');
    }
  }
}

inspectPlugin('DeliveryPlugin', DeliveryPlugin);
inspectPlugin('CouponPlugin', CouponPlugin);

// 检查 DeliveryPlugin.init() 返回什么
console.log('\n=== DeliveryPlugin.init() result ===');
const initResult = DeliveryPlugin.init();
console.log('Type:', typeof initResult);
console.log('Is function:', typeof initResult === 'function');
console.log('Name:', initResult?.name);
console.log('Same as DeliveryPlugin:', initResult === DeliveryPlugin);
