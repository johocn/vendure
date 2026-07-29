"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WishlistPlugin = void 0;
const core_1 = require("@vendure/core");
const api_extensions_1 = require("./api/api-extensions");
const wishlist_resolver_1 = require("./api/wishlist.resolver");
const wishlist_item_entity_1 = require("./entities/wishlist-item.entity");
const wishlist_service_1 = require("./service/wishlist.service");
require("./types");
let WishlistPlugin = class WishlistPlugin {
};
exports.WishlistPlugin = WishlistPlugin;
exports.WishlistPlugin = WishlistPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [wishlist_item_entity_1.WishlistItem],
        providers: [wishlist_service_1.WishlistService],
        shopApiExtensions: {
            schema: api_extensions_1.shopApiExtensions,
            resolvers: [wishlist_resolver_1.WishlistShopResolver],
        },
        configuration: config => {
            config.customFields.Customer.push({
                name: 'wishlistItems',
                type: 'relation',
                list: true,
                entity: wishlist_item_entity_1.WishlistItem,
                internal: true,
            });
            return config;
        },
    })
], WishlistPlugin);
//# sourceMappingURL=wishlist.plugin.js.map