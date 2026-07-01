"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultAssetStorageStrategyFactory = defaultAssetStorageStrategyFactory;
const common_1 = require("../common");
const local_asset_storage_strategy_1 = require("./local-asset-storage-strategy");
/**
 * By default the AssetServerPlugin will configure and use the LocalStorageStrategy to persist Assets.
 */
function defaultAssetStorageStrategyFactory(options) {
    const { assetUrlPrefix, assetUploadDir, route } = options;
    const prefixFn = (0, common_1.getAssetUrlPrefixFn)(options);
    const toAbsoluteUrlFn = (request, identifier) => {
        if (!identifier) {
            return '';
        }
        const prefix = prefixFn(request, identifier);
        return identifier.startsWith(prefix) ? identifier : `${prefix}${identifier}`;
    };
    return new local_asset_storage_strategy_1.LocalAssetStorageStrategy(assetUploadDir, toAbsoluteUrlFn);
}
//# sourceMappingURL=default-asset-storage-strategy-factory.js.map