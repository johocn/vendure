// Test if the schema function works
const { DeliveryPlugin } = require('@vendure/delivery-plugin');
const { PLUGIN_METADATA } = require('@vendure/core/dist/plugin/plugin-metadata');

const adminApiExt = Reflect.getMetadata(PLUGIN_METADATA.ADMIN_API_EXTENSIONS, DeliveryPlugin);
console.log('adminApiExtensions:', typeof adminApiExt);
console.log('schema:', typeof adminApiExt?.schema);
console.log('resolvers:', adminApiExt?.resolvers);

if (typeof adminApiExt?.schema === 'function') {
  try {
    const schema = adminApiExt.schema();
    console.log('schema result:', typeof schema);
    console.log('schema definitions:', schema?.definitions?.length);
    if (schema?.loc?.source?.body) {
      console.log('schema body (first 200):', schema.loc.source.body.substring(0, 200));
    }
  } catch (e) {
    console.error('Schema function failed:', e.message);
  }
}

if (Array.isArray(adminApiExt?.resolvers)) {
  console.log('\nResolvers:');
  adminApiExt.resolvers.forEach((r, i) => {
    console.log(`  [${i}]: ${typeof r} - ${r?.name ?? 'unnamed'}`);
  });
}

// Also check the configuration function
const configFn = Reflect.getMetadata(PLUGIN_METADATA.CONFIGURATION, DeliveryPlugin);
console.log('\nConfiguration function:', typeof configFn);
if (typeof configFn === 'function') {
  try {
    const mockConfig = {
      authOptions: { customPermissions: [] },
      customFields: { Order: [], Address: [] },
    };
    const result = configFn(mockConfig);
    console.log('Config result customPermissions count:', result.authOptions.customPermissions.length);
    console.log('Config result Order customFields count:', result.customFields.Order.length);
    console.log('Config result Address customFields count:', result.customFields.Address.length);
  } catch (e) {
    console.error('Configuration function failed:', e.message);
  }
}
