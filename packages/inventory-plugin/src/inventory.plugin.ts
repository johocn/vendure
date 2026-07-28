import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { InventoryService } from './inventory.service';
import { InventoryAdminResolver } from './inventory-admin.resolver';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [InventoryService],
    adminApiExtensions: {
        resolvers: [InventoryAdminResolver],
    },
    compatibility: '^3.6.0',
})
export class InventoryPlugin {
    static init = (): typeof InventoryPlugin => InventoryPlugin;
}
