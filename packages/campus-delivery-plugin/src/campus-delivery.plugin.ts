import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

@VendurePlugin({
  imports: [PluginCommonModule],
  compatibility: '^3.6.4',
})
export class CampusDeliveryPlugin {}
