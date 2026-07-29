// Check if the imported values are actually defined
const core = require('@vendure/core');
console.log('PluginCommonModule:', typeof core.PluginCommonModule);

const { PluginCommonModule } = require('@vendure/core');
console.log('PluginCommonModule (destructured):', typeof PluginCommonModule);

const { DeliveryService } = require('@vendure/delivery-plugin/dist/delivery.service');
console.log('DeliveryService:', typeof DeliveryService);

const { PermissionAdminResolver } = require('@vendure/delivery-plugin/dist/permission-admin.resolver');
console.log('PermissionAdminResolver:', typeof PermissionAdminResolver);

const { DeliveryAdminResolver } = require('@vendure/delivery-plugin/dist/delivery-admin.resolver');
console.log('DeliveryAdminResolver:', typeof DeliveryAdminResolver);

// Now check the DeliveryPlugin's VendurePlugin metadata
const { DeliveryPlugin } = require('@vendure/delivery-plugin');

// Vendure stores plugin config in a specific metadata key
// Let's check what VendurePlugin decorator actually does
const pluginConfig = DeliveryPlugin?.configuration;
console.log('\nDeliveryPlugin.configuration:', typeof pluginConfig);

// Check if there's a static method/property that Vendure uses
console.log('\nAll properties of DeliveryPlugin:');
Object.getOwnPropertyNames(DeliveryPlugin).forEach(key => {
  if (key !== 'length' && key !== 'prototype' && key !== 'name') {
    console.log(`  ${key}: ${typeof DeliveryPlugin[key]}`);
  }
});

// Try to instantiate and see what happens
try {
  const instance = new DeliveryPlugin();
  console.log('\nInstance created:', !!instance);
  console.log('Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(instance)));
} catch (e) {
  console.log('\nInstantiation failed:', e.message);
}
