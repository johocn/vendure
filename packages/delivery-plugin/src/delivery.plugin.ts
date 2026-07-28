// e:\code\vendure\packages\delivery-plugin\src\delivery.plugin.ts
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { deliveryPermissionDefinitions } from './constants';

@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: (config) => {
    // 注册自定义 Permission
    config.authOptions.customPermissions = [
      ...(config.authOptions.customPermissions ?? []),
      ...deliveryPermissionDefinitions,
    ];
    // 扩展 Order customFields（Task 2 会补充）
    // 扩展 Address customFields（Task 2 会补充）
    return config;
  },
})
export class DeliveryPlugin {
  static init = () => new DeliveryPlugin();
}
