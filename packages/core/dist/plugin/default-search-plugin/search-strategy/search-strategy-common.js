"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fieldsToSelect = void 0;
exports.getFieldsToSelect = getFieldsToSelect;
exports.fieldsToSelect = [
    'sku',
    'enabled',
    'slug',
    'price',
    'priceWithTax',
    'productVariantId',
    'languageCode',
    'productId',
    'productName',
    'productVariantName',
    'description',
    'facetIds',
    'facetValueIds',
    'collectionIds',
    'channelIds',
    'productAssetId',
    'productPreview',
    'productPreviewFocalPoint',
    'productVariantAssetId',
    'productVariantPreview',
    'productVariantPreviewFocalPoint',
];
function getFieldsToSelect(includeStockStatus = false, includeCurrencyCode = false) {
    const _fieldsToSelect = [...exports.fieldsToSelect];
    if (includeStockStatus) {
        _fieldsToSelect.push('inStock');
    }
    if (includeCurrencyCode) {
        _fieldsToSelect.push('currencyCode');
    }
    return _fieldsToSelect;
}
//# sourceMappingURL=search-strategy-common.js.map