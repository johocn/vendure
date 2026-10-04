import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { CampusBuilding } from './campus-building.entity';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusZone } from './campus-zone.entity';
import { campusCustomFields } from './custom-fields';
import { CreateCampusTablesMigration } from './migrations/create-campus-tables';
import { RiderEarning } from './rider-earning.entity';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [CampusZone, CampusBuilding, RiderEarning, CampusFulfillmentConfig],
    providers: [CreateCampusTablesMigration],
    configuration: config => {
        config.customFields = {
            ...config.customFields,
            Order: [...(config.customFields.Order ?? []), ...(campusCustomFields.Order ?? [])],
            Customer: [...(config.customFields.Customer ?? []), ...(campusCustomFields.Customer ?? [])],
        };
        return config;
    },
    compatibility: '^3.6.4',
})
export class CampusDeliveryPlugin {}
