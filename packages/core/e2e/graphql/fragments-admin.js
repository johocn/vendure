"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shippingMethodFragment = exports.productWithOptionsFragment = exports.productOptionGroupFragment = exports.customerGroupFragment = exports.globalSettingsFragment = exports.channelFragment = exports.fulfillmentFragment = exports.variantWithStockFragment = exports.currentUserFragment = exports.taxRateFragment = exports.zoneFragment = exports.promotionFragment = exports.orderWithModificationsFragment = exports.orderWithLinesFragment = exports.refundFragment = exports.paymentFragment = exports.canceledOrderFragment = exports.orderFragment = exports.shippingAddressFragment = exports.adjustmentFragment = exports.customerFragment = exports.addressFragment = exports.countryFragment = exports.facetWithValuesFragment = exports.facetValueFragment = exports.collectionFragment = exports.configurableFragment = exports.roleFragment = exports.productWithVariantsFragment = exports.productVariantFragment = exports.assetFragment = exports.administratorFragment = void 0;
const graphql_admin_1 = require("./graphql-admin");
exports.administratorFragment = (0, graphql_admin_1.graphql)(`
    fragment Administrator on Administrator {
        id
        firstName
        lastName
        emailAddress
        user {
            id
            identifier
            lastLogin
            roles {
                id
                code
                description
                permissions
            }
        }
    }
`);
exports.assetFragment = (0, graphql_admin_1.graphql)(`
    fragment Asset on Asset {
        id
        name
        fileSize
        mimeType
        type
        preview
        source
    }
`);
exports.productVariantFragment = (0, graphql_admin_1.graphql)(`
        fragment ProductVariant on ProductVariant {
            id
            createdAt
            updatedAt
            enabled
            languageCode
            name
            currencyCode
            price
            priceWithTax
            prices {
                currencyCode
                price
            }
            stockOnHand
            trackInventory
            taxRateApplied {
                id
                name
                value
            }
            taxCategory {
                id
                name
            }
            sku
            options {
                id
                code
                languageCode
                groupId
                name
            }
            facetValues {
                id
                code
                name
                facet {
                    id
                    name
                }
            }
            featuredAsset {
                ...Asset
            }
            assets {
                ...Asset
            }
            translations {
                id
                languageCode
                name
            }
            channels {
                id
                code
            }
        }
    `, [exports.assetFragment]);
exports.productWithVariantsFragment = (0, graphql_admin_1.graphql)(`
        fragment ProductWithVariants on Product {
            id
            enabled
            languageCode
            name
            slug
            description
            featuredAsset {
                ...Asset
            }
            assets {
                ...Asset
            }
            translations {
                languageCode
                name
                slug
                description
            }
            optionGroups {
                id
                languageCode
                code
                name
            }
            variants {
                ...ProductVariant
            }
            facetValues {
                id
                code
                name
                facet {
                    id
                    name
                }
            }
            channels {
                id
                code
            }
        }
    `, [exports.productVariantFragment, exports.assetFragment]);
exports.roleFragment = (0, graphql_admin_1.graphql)(`
    fragment Role on Role {
        id
        code
        description
        permissions
        channels {
            id
            code
            token
        }
    }
`);
exports.configurableFragment = (0, graphql_admin_1.graphql)(`
    fragment ConfigurableOperation on ConfigurableOperation {
        args {
            name
            value
        }
        code
    }
`);
exports.collectionFragment = (0, graphql_admin_1.graphql)(`
        fragment Collection on Collection {
            id
            name
            slug
            description
            isPrivate
            languageCode
            featuredAsset {
                ...Asset
            }
            assets {
                ...Asset
            }
            filters {
                ...ConfigurableOperation
            }
            translations {
                id
                languageCode
                name
                slug
                description
            }
            parent {
                id
                name
            }
            children {
                id
                name
                position
            }
        }
    `, [exports.assetFragment, exports.configurableFragment]);
exports.facetValueFragment = (0, graphql_admin_1.graphql)(`
    fragment FacetValue on FacetValue {
        id
        languageCode
        code
        name
        translations {
            id
            languageCode
            name
        }
        facet {
            id
            name
        }
    }
`);
exports.facetWithValuesFragment = (0, graphql_admin_1.graphql)(`
        fragment FacetWithValues on Facet {
            id
            languageCode
            isPrivate
            code
            name
            translations {
                id
                languageCode
                name
            }
            values {
                ...FacetValue
            }
        }
    `, [exports.facetValueFragment]);
exports.countryFragment = (0, graphql_admin_1.graphql)(`
    fragment Country on Region {
        id
        code
        name
        enabled
        translations {
            id
            languageCode
            name
        }
    }
`);
exports.addressFragment = (0, graphql_admin_1.graphql)(`
    fragment Address on Address {
        id
        fullName
        company
        streetLine1
        streetLine2
        city
        province
        postalCode
        country {
            id
            code
            name
        }
        phoneNumber
        defaultShippingAddress
        defaultBillingAddress
    }
`);
exports.customerFragment = (0, graphql_admin_1.graphql)(`
        fragment Customer on Customer {
            id
            title
            firstName
            lastName
            phoneNumber
            emailAddress
            user {
                id
                identifier
                verified
                lastLogin
            }
            addresses {
                ...Address
            }
        }
    `, [exports.addressFragment]);
exports.adjustmentFragment = (0, graphql_admin_1.graphql)(`
    fragment Adjustment on Adjustment {
        adjustmentSource
        amount
        description
        type
    }
`);
exports.shippingAddressFragment = (0, graphql_admin_1.graphql)(`
    fragment ShippingAddress on OrderAddress {
        fullName
        company
        streetLine1
        streetLine2
        city
        province
        postalCode
        country
        countryCode
        phoneNumber
    }
`);
exports.orderFragment = (0, graphql_admin_1.graphql)(`
    fragment Order on Order {
        id
        createdAt
        updatedAt
        code
        active
        state
        total
        totalWithTax
        totalQuantity
        currencyCode
        customer {
            id
            firstName
            lastName
        }
    }
`);
exports.canceledOrderFragment = (0, graphql_admin_1.graphql)(`
    fragment CanceledOrder on Order {
        id
        state
        lines {
            id
            quantity
        }
    }
`);
exports.paymentFragment = (0, graphql_admin_1.graphql)(`
    fragment Payment on Payment {
        id
        transactionId
        amount
        method
        state
        nextStates
        metadata
        refunds {
            id
            total
            reason
        }
    }
`);
exports.refundFragment = (0, graphql_admin_1.graphql)(`
    fragment Refund on Refund {
        id
        state
        items
        transactionId
        shipping
        total
        metadata
    }
`);
exports.orderWithLinesFragment = (0, graphql_admin_1.graphql)(`
        fragment OrderWithLines on Order {
            id
            createdAt
            updatedAt
            code
            state
            active
            customer {
                id
                firstName
                lastName
            }
            lines {
                id
                featuredAsset {
                    preview
                }
                productVariant {
                    id
                    name
                    sku
                }
                taxLines {
                    description
                    taxRate
                }
                unitPrice
                unitPriceWithTax
                quantity
                unitPrice
                unitPriceWithTax
                taxRate
                linePriceWithTax
            }
            surcharges {
                id
                description
                sku
                price
                priceWithTax
            }
            subTotal
            subTotalWithTax
            total
            totalWithTax
            totalQuantity
            currencyCode
            shipping
            shippingWithTax
            shippingLines {
                priceWithTax
                shippingMethod {
                    id
                    code
                    name
                    description
                }
            }
            shippingAddress {
                ...ShippingAddress
            }
            payments {
                ...Payment
            }
            fulfillments {
                id
                state
                method
                trackingCode
                lines {
                    orderLineId
                    quantity
                }
            }
            total
        }
    `, [exports.shippingAddressFragment, exports.paymentFragment]);
exports.orderWithModificationsFragment = (0, graphql_admin_1.graphql)(`
        fragment OrderWithModifications on Order {
            id
            state
            subTotal
            subTotalWithTax
            shipping
            shippingWithTax
            total
            totalWithTax
            lines {
                id
                quantity
                orderPlacedQuantity
                linePrice
                linePriceWithTax
                unitPriceWithTax
                discountedLinePriceWithTax
                proratedLinePriceWithTax
                proratedUnitPriceWithTax
                discounts {
                    description
                    amountWithTax
                }
                productVariant {
                    id
                    name
                }
            }
            surcharges {
                id
                description
                sku
                price
                priceWithTax
                taxRate
            }
            payments {
                ...Payment
            }
            modifications {
                id
                note
                priceChange
                isSettled
                lines {
                    orderLineId
                    quantity
                }
                surcharges {
                    id
                }
                payment {
                    id
                    state
                    amount
                    method
                }
                refund {
                    id
                    state
                    total
                    paymentId
                }
            }
            promotions {
                id
                name
                couponCode
            }
            discounts {
                description
                adjustmentSource
                amount
                amountWithTax
            }
            shippingAddress {
                ...ShippingAddress
            }
            billingAddress {
                ...ShippingAddress
            }
            shippingLines {
                id
                discountedPriceWithTax
                shippingMethod {
                    id
                    name
                }
            }
        }
    `, [exports.paymentFragment, exports.shippingAddressFragment]);
exports.promotionFragment = (0, graphql_admin_1.graphql)(`
        fragment Promotion on Promotion {
            id
            createdAt
            updatedAt
            couponCode
            startsAt
            endsAt
            name
            description
            enabled
            perCustomerUsageLimit
            usageLimit
            conditions {
                ...ConfigurableOperation
            }
            actions {
                ...ConfigurableOperation
            }
            translations {
                id
                languageCode
                name
                description
            }
        }
    `, [exports.configurableFragment]);
exports.zoneFragment = (0, graphql_admin_1.graphql)(`
        fragment Zone on Zone {
            id
            name
            members {
                ...Country
            }
        }
    `, [exports.countryFragment]);
exports.taxRateFragment = (0, graphql_admin_1.graphql)(`
    fragment TaxRate on TaxRate {
        id
        name
        enabled
        value
        category {
            id
            name
        }
        zone {
            id
            name
        }
        customerGroup {
            id
            name
        }
    }
`);
exports.currentUserFragment = (0, graphql_admin_1.graphql)(`
    fragment CurrentUser on CurrentUser {
        id
        identifier
        channels {
            code
            token
            permissions
        }
    }
`);
exports.variantWithStockFragment = (0, graphql_admin_1.graphql)(`
    fragment VariantWithStock on ProductVariant {
        id
        stockOnHand
        stockAllocated
        stockMovements {
            items {
                ... on StockMovement {
                    id
                    type
                    quantity
                }
            }
            totalItems
        }
    }
`);
exports.fulfillmentFragment = (0, graphql_admin_1.graphql)(`
    fragment Fulfillment on Fulfillment {
        id
        state
        nextStates
        method
        trackingCode
        lines {
            orderLineId
            quantity
        }
    }
`);
exports.channelFragment = (0, graphql_admin_1.graphql)(`
    fragment Channel on Channel {
        id
        code
        token
        currencyCode
        availableCurrencyCodes
        defaultCurrencyCode
        defaultLanguageCode
        defaultShippingZone {
            id
        }
        defaultTaxZone {
            id
        }
        pricesIncludeTax
    }
`);
exports.globalSettingsFragment = (0, graphql_admin_1.graphql)(`
    fragment GlobalSettings on GlobalSettings {
        id
        availableLanguages
        trackInventory
        outOfStockThreshold
        serverConfig {
            orderProcess {
                name
                to
            }
            permittedAssetTypes
            permissions {
                name
                description
                assignable
            }
            customFieldConfig {
                Customer {
                    ... on CustomField {
                        name
                    }
                }
            }
        }
    }
`);
exports.customerGroupFragment = (0, graphql_admin_1.graphql)(`
    fragment CustomerGroup on CustomerGroup {
        id
        name
        customers {
            items {
                id
            }
            totalItems
        }
    }
`);
exports.productOptionGroupFragment = (0, graphql_admin_1.graphql)(`
    fragment ProductOptionGroup on ProductOptionGroup {
        id
        code
        name
        options {
            id
            code
            name
        }
        translations {
            id
            languageCode
            name
        }
    }
`);
exports.productWithOptionsFragment = (0, graphql_admin_1.graphql)(`
    fragment ProductWithOptions on Product {
        id
        optionGroups {
            id
            code
            options {
                id
                code
            }
        }
    }
`);
exports.shippingMethodFragment = (0, graphql_admin_1.graphql)(`
    fragment ShippingMethod on ShippingMethod {
        id
        code
        name
        description
        calculator {
            code
            args {
                name
                value
            }
        }
        checker {
            code
            args {
                name
                value
            }
        }
    }
`);
//# sourceMappingURL=fragments-admin.js.map