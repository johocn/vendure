// e:\code\vendure\packages\delivery-plugin\src\delivery.plugin.ts
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { deliveryPermissionDefinitions } from './constants';
import { deliveryOrderCustomFields } from './config/order-custom-fields';
import { deliveryAddressCustomFields } from './config/address-custom-fields';

@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: (config) => {
    // 注册自定义 Permission
    config.authOptions.customPermissions = [
      ...(config.authOptions.customPermissions ?? []),
      ...deliveryPermissionDefinitions,
    ];
    // 扩展 Order customFields
    config.customFields.Order = [
      ...(config.customFields.Order ?? []),
      ...(deliveryOrderCustomFields.Order ?? []),
    ];
    // 扩展 Address customFields
    config.customFields.Address = [
      ...(config.customFields.Address ?? []),
      ...(deliveryAddressCustomFields.Address ?? []),
    ];
    return config;
  },
})
export class DeliveryPlugin {
  static init = () => new DeliveryPlugin();
}
