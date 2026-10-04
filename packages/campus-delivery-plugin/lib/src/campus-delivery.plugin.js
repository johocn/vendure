"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampusDeliveryPlugin = void 0;
const core_1 = require("@vendure/core");
const campus_building_entity_1 = require("./campus-building.entity");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_zone_entity_1 = require("./campus-zone.entity");
const custom_fields_1 = require("./custom-fields");
const create_campus_tables_1 = require("./migrations/create-campus-tables");
const rider_earning_entity_1 = require("./rider-earning.entity");
let CampusDeliveryPlugin = class CampusDeliveryPlugin {
};
exports.CampusDeliveryPlugin = CampusDeliveryPlugin;
exports.CampusDeliveryPlugin = CampusDeliveryPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [campus_zone_entity_1.CampusZone, campus_building_entity_1.CampusBuilding, rider_earning_entity_1.RiderEarning, campus_fulfillment_config_entity_1.CampusFulfillmentConfig],
        providers: [create_campus_tables_1.CreateCampusTablesMigration],
        configuration: config => {
            var _a, _b, _c, _d;
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Order: [...((_a = config.customFields.Order) !== null && _a !== void 0 ? _a : []), ...((_b = custom_fields_1.campusCustomFields.Order) !== null && _b !== void 0 ? _b : [])], Customer: [...((_c = config.customFields.Customer) !== null && _c !== void 0 ? _c : []), ...((_d = custom_fields_1.campusCustomFields.Customer) !== null && _d !== void 0 ? _d : [])] });
            return config;
        },
        compatibility: '^3.6.4',
    })
], CampusDeliveryPlugin);
//# sourceMappingURL=campus-delivery.plugin.js.map