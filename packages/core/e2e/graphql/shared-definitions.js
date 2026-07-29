"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPromotionDocument = exports.cancelJobDocument = exports.getRunningJobsDocument = exports.getStockMovementByTypeDocument = exports.getStockMovementDocument = exports.getProductIdNameDocument = exports.getProductSimpleDocument = exports.deleteProductDocument = exports.getFacetListSimpleDocument = exports.getFacetListDocument = exports.getGlobalSettingsDocument = exports.updateCountryDocument = exports.getCountryListDocument = exports.logoutDocument = exports.attemptLoginDocument = exports.getCustomerDocument = exports.updateCollectionDocument = exports.createCollectionDocument = exports.createRoleDocument = exports.getAssetListDocument = exports.getCustomerIdsDocument = exports.getCustomerListDocument = exports.deleteFacetDocument = exports.deleteFacetValuesDocument = exports.updateFacetValuesDocument = exports.createFacetValuesDocument = exports.updateFacetValueDocument = exports.createFacetValueDocument = exports.updateFacetDocument = exports.createFacetDocument = exports.updateTaxRateDocument = exports.updateProductVariantsDocument = exports.createProductVariantsDocument = exports.getProductsListWithVariantsDocument = exports.getProductWithFacetValuesDocument = exports.getProductListDocument = exports.getProductWithVariantsDocument = exports.createProductDocument = exports.updateProductOptionGroupDocument = exports.updateProductDocument = exports.deleteAdministratorDocument = exports.updateActiveAdministratorDocument = exports.updateAdministratorDocument = exports.getActiveAdministratorDocument = exports.getAdministratorDocument = exports.getAdministratorsDocument = exports.createAdministratorDocument = exports.runTaskDocument = exports.updateTaskDocument = exports.getTasksDocument = void 0;
exports.getProductWithVariantListDocument = exports.getProductVariantDocument = exports.getOptionGroupDocument = exports.removeOptionGroupFromProductDocument = exports.addOptionGroupToProductDocument = exports.createProductOptionGroupDocument = exports.getProductsWithVariantPricesDocument = exports.updateRoleDocument = exports.updateGlobalSettingsDocument = exports.cancelOrderDocument = exports.adminTransitionToStateDocument = exports.getCustomerWithGroupsDocument = exports.addCustomersToGroupDocument = exports.getCustomerGroupDocument = exports.getCustomerGroupsDocument = exports.deleteCustomerGroupDocument = exports.updateCustomerGroupDocument = exports.deleteCustomerNoteDocument = exports.updateCustomerNoteDocument = exports.deleteCustomerDocument = exports.updateCustomerDocument = exports.createCustomerDocument = exports.updateAddressDocument = exports.createAddressDocument = exports.getOrdersListDocument = exports.getOrderFulfillmentsDocument = exports.transitFulfillmentDocument = exports.createFulfillmentDocument = exports.removeCustomersFromGroupDocument = exports.createCustomerGroupDocument = exports.getOrderDocument = exports.getCustomerHistoryDocument = exports.updateChannelDocument = exports.deleteAssetDocument = exports.updateAssetDocument = exports.duplicateEntityDocument = exports.getEntityDuplicatorsDocument = exports.deleteProductOptionGroupsDocument = exports.deleteProductOptionGroupDocument = exports.removeProductOptionGroupsFromChannelDocument = exports.assignProductOptionGroupsToChannelDocument = exports.removeFacetsFromChannelDocument = exports.assignFacetsToChannelDocument = exports.removeProductVariantFromChannelDocument = exports.assignProductVariantToChannelDocument = exports.removeProductFromChannelDocument = exports.assignProductToChannelDocument = exports.deleteProductVariantDocument = exports.createChannelDocument = exports.MeDocument = void 0;
exports.setSettingsStoreValueDocument = exports.getSettingsStoreValuesDocument = exports.getSettingsStoreValueDocument = exports.getOrderWithCustomFieldsDocument = exports.getOrderWithModificationsDocument = exports.addManualPaymentToOrderDocument = exports.modifyOrderDocument = exports.addManualPaymentDocument = exports.getOrderWithLineCalculatedPropsDocument = exports.getOrderAssetEdgeCaseDocument = exports.setOrderCustomerDocument = exports.cancelPaymentDocument = exports.getOrderListFulfillmentsDocument = exports.getOrderLineFulfillmentsDocument = exports.deleteOrderNoteDocument = exports.updateOrderNoteDocument = exports.addNoteToOrderDocument = exports.settleRefundDocument = exports.refundOrderDocument = exports.getOrderListWithQtyDocument = exports.getOrderWithPaymentsDocument = exports.getOrderListDocument = exports.getPromotionDocument = exports.getFacetValueDocument = exports.getFacetValuesDocument = exports.getFacetWithValueListDocument = exports.getFacetWithValuesDocument = exports.getCollectionDocument = exports.assignCollectionsToChannelDocument = exports.getChannelsDocument = exports.deletePromotionDocument = exports.getProductVariantListDocument = exports.transitionPaymentToStateDocument = exports.getCollectionsDocument = exports.getShippingMethodListDocument = exports.getTaxRatesListDocument = exports.deleteTaxRateDocument = exports.createTaxRateDocument = exports.getTaxRateDocument = exports.removePromotionsFromChannelDocument = exports.assignPromotionsToChannelDocument = exports.deleteShippingMethodDocument = exports.createAssetsDocument = exports.assetWithTagsAndFocalPointFragmentDocument = exports.getAssetFragmentFirstDocument = exports.getAssetDocument = exports.updateShippingMethodDocument = exports.getOrderHistoryDocument = exports.settlePaymentDocument = exports.createShippingMethodDocument = void 0;
exports.deleteCustomerAddressDocument = exports.addNoteToCustomerDocument = exports.getCustomerOrdersDocument = exports.getCustomerWithUserDocument = exports.getAdjustmentOperationsDocument = exports.configurableOperationDefFragment = exports.getPromotionListDocument = exports.updatePromotionDocument = exports.getCustomerUserAuthDocument = exports.getCustomersDocument = exports.authenticateDocument = exports.getProductWithPublicCustomFieldsDocument = exports.getProductWithCustomFieldsDocument = exports.removeMembersFromZoneDocument = exports.addMembersToZoneDocument = exports.deleteZoneDocument = exports.updateZoneDocument = exports.createZoneDocument = exports.getActiveChannelWithZoneMembersDocument = exports.getZoneDocument = exports.getZonesDocument = exports.getCheckersDocument = exports.setSettingsStoreValuesDocument = void 0;
const fragments_admin_1 = require("./fragments-admin");
const graphql_admin_1 = require("./graphql-admin");
exports.getTasksDocument = (0, graphql_admin_1.graphql)(`
    query GetTasks {
        scheduledTasks {
            id
            description
            schedule
            scheduleDescription
            lastResult
            enabled
        }
    }
`);
exports.updateTaskDocument = (0, graphql_admin_1.graphql)(`
    mutation UpdateTask($input: UpdateScheduledTaskInput!) {
        updateScheduledTask(input: $input) {
            id
            enabled
        }
    }
`);
exports.runTaskDocument = (0, graphql_admin_1.graphql)(`
    mutation RunTask($id: String!) {
        runScheduledTask(id: $id) {
            success
        }
    }
`);
exports.createAdministratorDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateAdministrator($input: CreateAdministratorInput!) {
            createAdministrator(input: $input) {
                ...Administrator
            }
        }
    `, [fragments_admin_1.administratorFragment]);
exports.getAdministratorsDocument = (0, graphql_admin_1.graphql)(`
        query GetAdministrators($options: AdministratorListOptions) {
            administrators(options: $options) {
                items {
                    ...Administrator
                }
                totalItems
            }
        }
    `, [fragments_admin_1.administratorFragment]);
exports.getAdministratorDocument = (0, graphql_admin_1.graphql)(`
        query GetAdministrator($id: ID!) {
            administrator(id: $id) {
                ...Administrator
            }
        }
    `, [fragments_admin_1.administratorFragment]);
exports.getActiveAdministratorDocument = (0, graphql_admin_1.graphql)(`
        query ActiveAdministrator {
            activeAdministrator {
                ...Administrator
            }
        }
    `, [fragments_admin_1.administratorFragment]);
exports.updateAdministratorDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateAdministrator($input: UpdateAdministratorInput!) {
            updateAdministrator(input: $input) {
                ...Administrator
            }
        }
    `, [fragments_admin_1.administratorFragment]);
exports.updateActiveAdministratorDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateActiveAdministrator($input: UpdateActiveAdministratorInput!) {
            updateActiveAdministrator(input: $input) {
                ...Administrator
            }
        }
    `, [fragments_admin_1.administratorFragment]);
exports.deleteAdministratorDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteAdministrator($id: ID!) {
        deleteAdministrator(id: $id) {
            message
            result
        }
    }
`);
exports.updateProductDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateProduct($input: UpdateProductInput!) {
            updateProduct(input: $input) {
                ...ProductWithVariants
            }
        }
    `, [fragments_admin_1.productWithVariantsFragment]);
exports.updateProductOptionGroupDocument = (0, graphql_admin_1.graphql)(`
    mutation UpdateOptionGroup($input: UpdateProductOptionGroupInput!) {
        updateProductOptionGroup(input: $input) {
            id
        }
    }
`);
exports.createProductDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateProduct($input: CreateProductInput!) {
            createProduct(input: $input) {
                ...ProductWithVariants
            }
        }
    `, [fragments_admin_1.productWithVariantsFragment]);
exports.getProductWithVariantsDocument = (0, graphql_admin_1.graphql)(`
        query GetProductWithVariants($id: ID, $slug: String) {
            product(slug: $slug, id: $id) {
                ...ProductWithVariants
            }
        }
    `, [fragments_admin_1.productWithVariantsFragment]);
exports.getProductListDocument = (0, graphql_admin_1.graphql)(`
    query GetProductList($options: ProductListOptions) {
        products(options: $options) {
            items {
                id
                languageCode
                name
                slug
                featuredAsset {
                    id
                    preview
                }
            }
            totalItems
        }
    }
`);
exports.getProductWithFacetValuesDocument = (0, graphql_admin_1.graphql)(`
    query GetProductWithFacetValues($id: ID!) {
        product(id: $id) {
            id
            facetValues {
                id
                name
                code
            }
            variants {
                id
                facetValues {
                    id
                    name
                    code
                }
            }
        }
    }
`);
exports.getProductsListWithVariantsDocument = (0, graphql_admin_1.graphql)(`
    query GetProductListWithVariants {
        products {
            items {
                id
                name
                variants {
                    id
                    name
                }
            }
            totalItems
        }
    }
`);
exports.createProductVariantsDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateProductVariants($input: [CreateProductVariantInput!]!) {
            createProductVariants(input: $input) {
                ...ProductVariant
            }
        }
    `, [fragments_admin_1.productVariantFragment]);
exports.updateProductVariantsDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateProductVariants($input: [UpdateProductVariantInput!]!) {
            updateProductVariants(input: $input) {
                ...ProductVariant
            }
        }
    `, [fragments_admin_1.productVariantFragment]);
exports.updateTaxRateDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateTaxRate($input: UpdateTaxRateInput!) {
            updateTaxRate(input: $input) {
                ...TaxRate
            }
        }
    `, [fragments_admin_1.taxRateFragment]);
exports.createFacetDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateFacet($input: CreateFacetInput!) {
            createFacet(input: $input) {
                ...FacetWithValues
            }
        }
    `, [fragments_admin_1.facetWithValuesFragment]);
exports.updateFacetDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateFacet($input: UpdateFacetInput!) {
            updateFacet(input: $input) {
                ...FacetWithValues
            }
        }
    `, [fragments_admin_1.facetWithValuesFragment]);
exports.createFacetValueDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateFacetValue($input: CreateFacetValueInput!) {
            createFacetValue(input: $input) {
                ...FacetValue
            }
        }
    `, [fragments_admin_1.facetValueFragment]);
exports.updateFacetValueDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateFacetValue($input: UpdateFacetValueInput!) {
            updateFacetValue(input: $input) {
                ...FacetValue
            }
        }
    `, [fragments_admin_1.facetValueFragment]);
exports.createFacetValuesDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateFacetValues($input: [CreateFacetValueInput!]!) {
            createFacetValues(input: $input) {
                ...FacetValue
            }
        }
    `, [fragments_admin_1.facetValueFragment]);
exports.updateFacetValuesDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateFacetValues($input: [UpdateFacetValueInput!]!) {
            updateFacetValues(input: $input) {
                ...FacetValue
            }
        }
    `, [fragments_admin_1.facetValueFragment]);
exports.deleteFacetValuesDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteFacetValues($ids: [ID!]!, $force: Boolean) {
        deleteFacetValues(ids: $ids, force: $force) {
            result
            message
        }
    }
`);
exports.deleteFacetDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteFacet($id: ID!, $force: Boolean) {
        deleteFacet(id: $id, force: $force) {
            result
            message
        }
    }
`);
exports.getCustomerListDocument = (0, graphql_admin_1.graphql)(`
    query GetCustomerList($options: CustomerListOptions) {
        customers(options: $options) {
            items {
                id
                title
                firstName
                lastName
                emailAddress
                phoneNumber
                user {
                    id
                    identifier
                    verified
                }
            }
            totalItems
        }
    }
`);
exports.getCustomerIdsDocument = (0, graphql_admin_1.graphql)(`
    query GetCustomerIds {
        customers {
            items {
                id
            }
        }
    }
`);
exports.getAssetListDocument = (0, graphql_admin_1.graphql)(`
        query GetAssetList($options: AssetListOptions) {
            assets(options: $options) {
                items {
                    ...Asset
                }
                totalItems
            }
        }
    `, [fragments_admin_1.assetFragment]);
exports.createRoleDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateRole($input: CreateRoleInput!) {
            createRole(input: $input) {
                ...Role
            }
        }
    `, [fragments_admin_1.roleFragment]);
exports.createCollectionDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateCollection($input: CreateCollectionInput!) {
            createCollection(input: $input) {
                ...Collection
            }
        }
    `, [fragments_admin_1.collectionFragment]);
exports.updateCollectionDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateCollection($input: UpdateCollectionInput!) {
            updateCollection(input: $input) {
                ...Collection
            }
        }
    `, [fragments_admin_1.collectionFragment]);
exports.getCustomerDocument = (0, graphql_admin_1.graphql)(`
        query GetCustomer($id: ID!, $orderListOptions: OrderListOptions) {
            customer(id: $id) {
                ...Customer
                orders(options: $orderListOptions) {
                    items {
                        id
                        code
                        state
                        total
                        currencyCode
                        updatedAt
                    }
                    totalItems
                }
            }
        }
    `, [fragments_admin_1.customerFragment]);
exports.attemptLoginDocument = (0, graphql_admin_1.graphql)(`
        mutation AttemptLogin($username: String!, $password: String!, $rememberMe: Boolean) {
            login(username: $username, password: $password, rememberMe: $rememberMe) {
                ...CurrentUser
                ... on ErrorResult {
                    errorCode
                    message
                }
            }
        }
    `, [fragments_admin_1.currentUserFragment]);
exports.logoutDocument = (0, graphql_admin_1.graphql)(`
    mutation Logout {
        logout {
            success
        }
    }
`);
exports.getCountryListDocument = (0, graphql_admin_1.graphql)(`
    query GetCountryList($options: CountryListOptions) {
        countries(options: $options) {
            items {
                id
                code
                name
                enabled
            }
            totalItems
        }
    }
`);
exports.updateCountryDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateCountry($input: UpdateCountryInput!) {
            updateCountry(input: $input) {
                ...Country
            }
        }
    `, [fragments_admin_1.countryFragment]);
exports.getGlobalSettingsDocument = (0, graphql_admin_1.graphql)(`
        query GetGlobalSettings {
            globalSettings {
                ...GlobalSettings
            }
        }
    `, [fragments_admin_1.globalSettingsFragment]);
exports.getFacetListDocument = (0, graphql_admin_1.graphql)(`
        query GetFacetList($options: FacetListOptions) {
            facets(options: $options) {
                items {
                    ...FacetWithValues
                }
                totalItems
            }
        }
    `, [fragments_admin_1.facetWithValuesFragment]);
exports.getFacetListSimpleDocument = (0, graphql_admin_1.graphql)(`
    query GetFacetListSimple($options: FacetListOptions) {
        facets(options: $options) {
            items {
                id
                name
            }
            totalItems
        }
    }
`);
exports.deleteProductDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteProduct($id: ID!) {
        deleteProduct(id: $id) {
            result
        }
    }
`);
exports.getProductSimpleDocument = (0, graphql_admin_1.graphql)(`
    query GetProductSimple($id: ID, $slug: String) {
        product(slug: $slug, id: $id) {
            id
            slug
        }
    }
`);
exports.getProductIdNameDocument = (0, graphql_admin_1.graphql)(`
    query GetProductIdName($id: ID!) {
        product(id: $id) {
            id
            name
        }
    }
`);
exports.getStockMovementDocument = (0, graphql_admin_1.graphql)(`
        query GetStockMovement($id: ID!) {
            product(id: $id) {
                id
                variants {
                    ...VariantWithStock
                }
            }
        }
    `, [fragments_admin_1.variantWithStockFragment]);
exports.getStockMovementByTypeDocument = (0, graphql_admin_1.graphql)(`
    query GetStockMovementByType($id: ID!, $type: StockMovementType!) {
        product(id: $id) {
            id
            variants {
                stockMovements(options: { type: $type }) {
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
        }
    }
`);
exports.getRunningJobsDocument = (0, graphql_admin_1.graphql)(`
    query GetRunningJobs($options: JobListOptions) {
        jobs(options: $options) {
            items {
                id
                queueName
                state
                isSettled
                duration
            }
            totalItems
        }
    }
`);
exports.cancelJobDocument = (0, graphql_admin_1.graphql)(`
    mutation CancelJob($id: ID!) {
        cancelJob(jobId: $id) {
            id
            state
            isSettled
            settledAt
        }
    }
`);
exports.createPromotionDocument = (0, graphql_admin_1.graphql)(`
        mutation CreatePromotion($input: CreatePromotionInput!) {
            createPromotion(input: $input) {
                ...Promotion
                ... on ErrorResult {
                    errorCode
                    message
                }
            }
        }
    `, [fragments_admin_1.promotionFragment]);
exports.MeDocument = (0, graphql_admin_1.graphql)(`
        query Me {
            me {
                ...CurrentUser
            }
        }
    `, [fragments_admin_1.currentUserFragment]);
exports.createChannelDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateChannel($input: CreateChannelInput!) {
            createChannel(input: $input) {
                ...Channel
                ... on LanguageNotAvailableError {
                    errorCode
                    message
                    languageCode
                }
            }
        }
    `, [fragments_admin_1.channelFragment]);
exports.deleteProductVariantDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteProductVariant($id: ID!) {
        deleteProductVariant(id: $id) {
            result
            message
        }
    }
`);
exports.assignProductToChannelDocument = (0, graphql_admin_1.graphql)(`
        mutation AssignProductsToChannel($input: AssignProductsToChannelInput!) {
            assignProductsToChannel(input: $input) {
                ...ProductWithVariants
            }
        }
    `, [fragments_admin_1.productWithVariantsFragment]);
exports.removeProductFromChannelDocument = (0, graphql_admin_1.graphql)(`
        mutation RemoveProductsFromChannel($input: RemoveProductsFromChannelInput!) {
            removeProductsFromChannel(input: $input) {
                ...ProductWithVariants
            }
        }
    `, [fragments_admin_1.productWithVariantsFragment]);
exports.assignProductVariantToChannelDocument = (0, graphql_admin_1.graphql)(`
        mutation AssignProductVariantsToChannel($input: AssignProductVariantsToChannelInput!) {
            assignProductVariantsToChannel(input: $input) {
                ...ProductVariant
            }
        }
    `, [fragments_admin_1.productVariantFragment]);
exports.removeProductVariantFromChannelDocument = (0, graphql_admin_1.graphql)(`
        mutation RemoveProductVariantsFromChannel($input: RemoveProductVariantsFromChannelInput!) {
            removeProductVariantsFromChannel(input: $input) {
                ...ProductVariant
            }
        }
    `, [fragments_admin_1.productVariantFragment]);
exports.assignFacetsToChannelDocument = (0, graphql_admin_1.graphql)(`
    mutation AssignFacetsToChannel($input: AssignFacetsToChannelInput!) {
        assignFacetsToChannel(input: $input) {
            id
            name
        }
    }
`);
exports.removeFacetsFromChannelDocument = (0, graphql_admin_1.graphql)(`
    mutation RemoveFacetsFromChannel($input: RemoveFacetsFromChannelInput!) {
        removeFacetsFromChannel(input: $input) {
            ... on Facet {
                id
                name
            }
            ... on FacetInUseError {
                errorCode
                message
                productCount
                variantCount
            }
        }
    }
`);
exports.assignProductOptionGroupsToChannelDocument = (0, graphql_admin_1.graphql)(`
    mutation AssignProductOptionGroupsToChannel($input: AssignProductOptionGroupsToChannelInput!) {
        assignProductOptionGroupsToChannel(input: $input) {
            id
            code
            name
        }
    }
`);
exports.removeProductOptionGroupsFromChannelDocument = (0, graphql_admin_1.graphql)(`
    mutation RemoveProductOptionGroupsFromChannel($input: RemoveProductOptionGroupsFromChannelInput!) {
        removeProductOptionGroupsFromChannel(input: $input) {
            ... on ProductOptionGroup {
                id
                code
                name
            }
            ... on ProductOptionGroupInUseError {
                errorCode
                message
                optionGroupCode
                productCount
                variantCount
            }
        }
    }
`);
exports.deleteProductOptionGroupDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteProductOptionGroup($id: ID!, $force: Boolean) {
        deleteProductOptionGroup(id: $id, force: $force) {
            result
            message
        }
    }
`);
exports.deleteProductOptionGroupsDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteProductOptionGroups($ids: [ID!]!, $force: Boolean) {
        deleteProductOptionGroups(ids: $ids, force: $force) {
            result
            message
        }
    }
`);
exports.getEntityDuplicatorsDocument = (0, graphql_admin_1.graphql)(`
    query GetEntityDuplicators {
        entityDuplicators {
            code
            description
            requiresPermission
            forEntities
            args {
                name
                type
                defaultValue
            }
        }
    }
`);
exports.duplicateEntityDocument = (0, graphql_admin_1.graphql)(`
    mutation DuplicateEntity($input: DuplicateEntityInput!) {
        duplicateEntity(input: $input) {
            ... on DuplicateEntitySuccess {
                newEntityId
            }
            ... on DuplicateEntityError {
                errorCode
                message
                duplicationError
            }
        }
    }
`);
exports.updateAssetDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateAsset($input: UpdateAssetInput!) {
            updateAsset(input: $input) {
                ...Asset
                ... on Asset {
                    tags {
                        id
                        value
                    }
                    focalPoint {
                        x
                        y
                    }
                }
            }
        }
    `, [fragments_admin_1.assetFragment]);
exports.deleteAssetDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteAsset($input: DeleteAssetInput!) {
        deleteAsset(input: $input) {
            result
            message
        }
    }
`);
exports.updateChannelDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateChannel($input: UpdateChannelInput!) {
            updateChannel(input: $input) {
                ...Channel
                ... on LanguageNotAvailableError {
                    errorCode
                    message
                    languageCode
                }
            }
        }
    `, [fragments_admin_1.channelFragment]);
exports.getCustomerHistoryDocument = (0, graphql_admin_1.graphql)(`
    query GetCustomerHistory($id: ID!, $options: HistoryEntryListOptions) {
        customer(id: $id) {
            id
            history(options: $options) {
                totalItems
                items {
                    id
                    administrator {
                        id
                    }
                    type
                    data
                }
            }
        }
    }
`);
exports.getOrderDocument = (0, graphql_admin_1.graphql)(`
        query GetOrder($id: ID!) {
            order(id: $id) {
                ...OrderWithLines
            }
        }
    `, [fragments_admin_1.orderWithLinesFragment]);
exports.createCustomerGroupDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateCustomerGroup($input: CreateCustomerGroupInput!) {
            createCustomerGroup(input: $input) {
                ...CustomerGroup
            }
        }
    `, [fragments_admin_1.customerGroupFragment]);
exports.removeCustomersFromGroupDocument = (0, graphql_admin_1.graphql)(`
        mutation RemoveCustomersFromGroup($groupId: ID!, $customerIds: [ID!]!) {
            removeCustomersFromGroup(customerGroupId: $groupId, customerIds: $customerIds) {
                ...CustomerGroup
            }
        }
    `, [fragments_admin_1.customerGroupFragment]);
exports.createFulfillmentDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateFulfillment($input: FulfillOrderInput!) {
            addFulfillmentToOrder(input: $input) {
                ...Fulfillment
                ... on ErrorResult {
                    errorCode
                    message
                }
                ... on CreateFulfillmentError {
                    fulfillmentHandlerError
                }
            }
        }
    `, [fragments_admin_1.fulfillmentFragment]);
exports.transitFulfillmentDocument = (0, graphql_admin_1.graphql)(`
        mutation TransitFulfillment($id: ID!, $state: String!) {
            transitionFulfillmentToState(id: $id, state: $state) {
                ...Fulfillment
                ... on FulfillmentStateTransitionError {
                    errorCode
                    message
                    transitionError
                    fromState
                    toState
                }
            }
        }
    `, [fragments_admin_1.fulfillmentFragment]);
exports.getOrderFulfillmentsDocument = (0, graphql_admin_1.graphql)(`
    query GetOrderFulfillments($id: ID!) {
        order(id: $id) {
            id
            state
            fulfillments {
                id
                state
                nextStates
                method
                summary {
                    orderLine {
                        id
                    }
                    quantity
                }
            }
        }
    }
`);
exports.getOrdersListDocument = (0, graphql_admin_1.graphql)(`
        query GetOrderListFull($options: OrderListOptions) {
            orders(options: $options) {
                items {
                    ...Order
                }
                totalItems
            }
        }
    `, [fragments_admin_1.orderFragment]);
exports.createAddressDocument = (0, graphql_admin_1.graphql)(`
    mutation CreateAddress($id: ID!, $input: CreateAddressInput!) {
        createCustomerAddress(customerId: $id, input: $input) {
            id
            fullName
            company
            streetLine1
            streetLine2
            city
            province
            postalCode
            country {
                code
                name
            }
            phoneNumber
            defaultShippingAddress
            defaultBillingAddress
        }
    }
`);
exports.updateAddressDocument = (0, graphql_admin_1.graphql)(`
    mutation UpdateAddress($input: UpdateAddressInput!) {
        updateCustomerAddress(input: $input) {
            id
            defaultShippingAddress
            defaultBillingAddress
            country {
                code
                name
            }
        }
    }
`);
exports.createCustomerDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateCustomer($input: CreateCustomerInput!, $password: String) {
            createCustomer(input: $input, password: $password) {
                ...Customer
                ... on ErrorResult {
                    errorCode
                    message
                }
            }
        }
    `, [fragments_admin_1.customerFragment]);
exports.updateCustomerDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateCustomer($input: UpdateCustomerInput!) {
            updateCustomer(input: $input) {
                ...Customer
                ... on ErrorResult {
                    errorCode
                    message
                }
            }
        }
    `, [fragments_admin_1.customerFragment]);
exports.deleteCustomerDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteCustomer($id: ID!) {
        deleteCustomer(id: $id) {
            result
        }
    }
`);
exports.updateCustomerNoteDocument = (0, graphql_admin_1.graphql)(`
    mutation UpdateCustomerNote($input: UpdateCustomerNoteInput!) {
        updateCustomerNote(input: $input) {
            id
            data
            isPublic
        }
    }
`);
exports.deleteCustomerNoteDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteCustomerNote($id: ID!) {
        deleteCustomerNote(id: $id) {
            result
            message
        }
    }
`);
exports.updateCustomerGroupDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateCustomerGroup($input: UpdateCustomerGroupInput!) {
            updateCustomerGroup(input: $input) {
                ...CustomerGroup
            }
        }
    `, [fragments_admin_1.customerGroupFragment]);
exports.deleteCustomerGroupDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteCustomerGroup($id: ID!) {
        deleteCustomerGroup(id: $id) {
            result
            message
        }
    }
`);
exports.getCustomerGroupsDocument = (0, graphql_admin_1.graphql)(`
    query GetCustomerGroups($options: CustomerGroupListOptions) {
        customerGroups(options: $options) {
            items {
                id
                name
            }
            totalItems
        }
    }
`);
exports.getCustomerGroupDocument = (0, graphql_admin_1.graphql)(`
    query GetCustomerGroup($id: ID!, $options: CustomerListOptions) {
        customerGroup(id: $id) {
            id
            name
            customers(options: $options) {
                items {
                    id
                }
                totalItems
            }
        }
    }
`);
exports.addCustomersToGroupDocument = (0, graphql_admin_1.graphql)(`
        mutation AddCustomersToGroup($groupId: ID!, $customerIds: [ID!]!) {
            addCustomersToGroup(customerGroupId: $groupId, customerIds: $customerIds) {
                ...CustomerGroup
            }
        }
    `, [fragments_admin_1.customerGroupFragment]);
exports.getCustomerWithGroupsDocument = (0, graphql_admin_1.graphql)(`
    query GetCustomerWithGroups($id: ID!) {
        customer(id: $id) {
            id
            groups {
                id
                name
            }
        }
    }
`);
exports.adminTransitionToStateDocument = (0, graphql_admin_1.graphql)(`
        mutation AdminTransition($id: ID!, $state: String!) {
            transitionOrderToState(id: $id, state: $state) {
                ...Order
                ... on OrderStateTransitionError {
                    errorCode
                    message
                    transitionError
                    fromState
                    toState
                }
            }
        }
    `, [fragments_admin_1.orderFragment]);
exports.cancelOrderDocument = (0, graphql_admin_1.graphql)(`
        mutation CancelOrder($input: CancelOrderInput!) {
            cancelOrder(input: $input) {
                ...CanceledOrder
                ... on ErrorResult {
                    errorCode
                    message
                }
            }
        }
    `, [fragments_admin_1.canceledOrderFragment]);
exports.updateGlobalSettingsDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateGlobalSettings($input: UpdateGlobalSettingsInput!) {
            updateGlobalSettings(input: $input) {
                ...GlobalSettings
                ... on ErrorResult {
                    errorCode
                    message
                }
            }
        }
    `, [fragments_admin_1.globalSettingsFragment]);
exports.updateRoleDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateRole($input: UpdateRoleInput!) {
            updateRole(input: $input) {
                ...Role
            }
        }
    `, [fragments_admin_1.roleFragment]);
exports.getProductsWithVariantPricesDocument = (0, graphql_admin_1.graphql)(`
    query GetProductsWithVariantPrices {
        products {
            items {
                id
                slug
                variants {
                    id
                    price
                    priceWithTax
                    currencyCode
                    sku
                    facetValues {
                        id
                        code
                    }
                }
            }
        }
    }
`);
exports.createProductOptionGroupDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateProductOptionGroup($input: CreateProductOptionGroupInput!) {
            createProductOptionGroup(input: $input) {
                ...ProductOptionGroup
            }
        }
    `, [fragments_admin_1.productOptionGroupFragment]);
exports.addOptionGroupToProductDocument = (0, graphql_admin_1.graphql)(`
        mutation AddOptionGroupToProduct($productId: ID!, $optionGroupId: ID!) {
            addOptionGroupToProduct(productId: $productId, optionGroupId: $optionGroupId) {
                ...ProductWithOptions
            }
        }
    `, [fragments_admin_1.productWithOptionsFragment]);
exports.removeOptionGroupFromProductDocument = (0, graphql_admin_1.graphql)(`
        mutation RemoveOptionGroupFromProduct($productId: ID!, $optionGroupId: ID!, $force: Boolean) {
            removeOptionGroupFromProduct(
                productId: $productId
                optionGroupId: $optionGroupId
                force: $force
            ) {
                ...ProductWithOptions
                ... on ProductOptionInUseError {
                    errorCode
                    message
                    optionGroupCode
                    productVariantCount
                }
            }
        }
    `, [fragments_admin_1.productWithOptionsFragment]);
exports.getOptionGroupDocument = (0, graphql_admin_1.graphql)(`
    query GetOptionGroup($id: ID!) {
        productOptionGroup(id: $id) {
            id
            code
            options {
                id
                code
            }
        }
    }
`);
exports.getProductVariantDocument = (0, graphql_admin_1.graphql)(`
    query GetProductVariant($id: ID!) {
        productVariant(id: $id) {
            id
            name
        }
    }
`);
exports.getProductWithVariantListDocument = (0, graphql_admin_1.graphql)(`
        query GetProductWithVariantList($id: ID, $variantListOptions: ProductVariantListOptions) {
            product(id: $id) {
                id
                variantList(options: $variantListOptions) {
                    items {
                        ...ProductVariant
                    }
                    totalItems
                }
            }
        }
    `, [fragments_admin_1.productVariantFragment]);
exports.createShippingMethodDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateShippingMethod($input: CreateShippingMethodInput!) {
            createShippingMethod(input: $input) {
                ...ShippingMethod
            }
        }
    `, [fragments_admin_1.shippingMethodFragment]);
exports.settlePaymentDocument = (0, graphql_admin_1.graphql)(`
        mutation SettlePayment($id: ID!) {
            settlePayment(id: $id) {
                ...Payment
                ... on ErrorResult {
                    errorCode
                    message
                }
                ... on SettlePaymentError {
                    paymentErrorMessage
                }
            }
        }
    `, [fragments_admin_1.paymentFragment]);
exports.getOrderHistoryDocument = (0, graphql_admin_1.graphql)(`
    query GetOrderHistory($id: ID!, $options: HistoryEntryListOptions) {
        order(id: $id) {
            id
            history(options: $options) {
                totalItems
                items {
                    id
                    type
                    administrator {
                        id
                    }
                    data
                }
            }
        }
    }
`);
exports.updateShippingMethodDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateShippingMethod($input: UpdateShippingMethodInput!) {
            updateShippingMethod(input: $input) {
                ...ShippingMethod
            }
        }
    `, [fragments_admin_1.shippingMethodFragment]);
exports.getAssetDocument = (0, graphql_admin_1.graphql)(`
        query GetAsset($id: ID!) {
            asset(id: $id) {
                ...Asset
                width
                height
            }
        }
    `, [fragments_admin_1.assetFragment]);
exports.getAssetFragmentFirstDocument = (0, graphql_admin_1.graphql)(`
    fragment AssetFragFirst on Asset {
        id
        preview
    }

    query GetAssetFragmentFirst($id: ID!) {
        asset(id: $id) {
            ...AssetFragFirst
        }
    }
`);
exports.assetWithTagsAndFocalPointFragmentDocument = (0, graphql_admin_1.graphql)(`
        fragment AssetWithTagsAndFocalPoint on Asset {
            ...Asset
            focalPoint {
                x
                y
            }
            tags {
                id
                value
            }
        }
    `, [fragments_admin_1.assetFragment]);
exports.createAssetsDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateAssets($input: [CreateAssetInput!]!) {
            createAssets(input: $input) {
                ...AssetWithTagsAndFocalPoint
                ... on MimeTypeError {
                    message
                    fileName
                    mimeType
                }
            }
        }
    `, [exports.assetWithTagsAndFocalPointFragmentDocument]);
exports.deleteShippingMethodDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteShippingMethod($id: ID!) {
        deleteShippingMethod(id: $id) {
            result
            message
        }
    }
`);
exports.assignPromotionsToChannelDocument = (0, graphql_admin_1.graphql)(`
    mutation AssignPromotionToChannel($input: AssignPromotionsToChannelInput!) {
        assignPromotionsToChannel(input: $input) {
            id
            name
        }
    }
`);
exports.removePromotionsFromChannelDocument = (0, graphql_admin_1.graphql)(`
    mutation RemovePromotionFromChannel($input: RemovePromotionsFromChannelInput!) {
        removePromotionsFromChannel(input: $input) {
            id
            name
        }
    }
`);
exports.getTaxRateDocument = (0, graphql_admin_1.graphql)(`
        query GetTaxRate($id: ID!) {
            taxRate(id: $id) {
                ...TaxRate
            }
        }
    `, [fragments_admin_1.taxRateFragment]);
exports.createTaxRateDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateTaxRate($input: CreateTaxRateInput!) {
            createTaxRate(input: $input) {
                ...TaxRate
            }
        }
    `, [fragments_admin_1.taxRateFragment]);
exports.deleteTaxRateDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteTaxRate($id: ID!) {
        deleteTaxRate(id: $id) {
            result
            message
        }
    }
`);
exports.getTaxRatesListDocument = (0, graphql_admin_1.graphql)(`
        query GetTaxRates($options: TaxRateListOptions) {
            taxRates(options: $options) {
                items {
                    ...TaxRate
                }
                totalItems
            }
        }
    `, [fragments_admin_1.taxRateFragment]);
exports.getShippingMethodListDocument = (0, graphql_admin_1.graphql)(`
        query GetShippingMethodList {
            shippingMethods {
                items {
                    ...ShippingMethod
                }
                totalItems
            }
        }
    `, [fragments_admin_1.shippingMethodFragment]);
exports.getCollectionsDocument = (0, graphql_admin_1.graphql)(`
    query GetCollections {
        collections {
            items {
                id
                name
                position
                parent {
                    id
                    name
                }
            }
        }
    }
`);
exports.transitionPaymentToStateDocument = (0, graphql_admin_1.graphql)(`
        mutation TransitionPaymentToState($id: ID!, $state: String!) {
            transitionPaymentToState(id: $id, state: $state) {
                ...Payment
                ... on ErrorResult {
                    errorCode
                    message
                }
                ... on PaymentStateTransitionError {
                    transitionError
                }
            }
        }
    `, [fragments_admin_1.paymentFragment]);
exports.getProductVariantListDocument = (0, graphql_admin_1.graphql)(`
    query GetProductVariantList($options: ProductVariantListOptions, $productId: ID) {
        productVariants(options: $options, productId: $productId) {
            items {
                id
                name
                sku
                price
                priceWithTax
                currencyCode
                prices {
                    currencyCode
                    price
                }
            }
            totalItems
        }
    }
`);
exports.deletePromotionDocument = (0, graphql_admin_1.graphql)(`
    mutation DeletePromotion($id: ID!) {
        deletePromotion(id: $id) {
            result
        }
    }
`);
exports.getChannelsDocument = (0, graphql_admin_1.graphql)(`
    query GetChannels {
        channels {
            items {
                id
                code
                token
            }
        }
    }
`);
exports.assignCollectionsToChannelDocument = (0, graphql_admin_1.graphql)(`
        mutation AssignCollectionsToChannel($input: AssignCollectionsToChannelInput!) {
            assignCollectionsToChannel(input: $input) {
                ...Collection
            }
        }
    `, [fragments_admin_1.collectionFragment]);
exports.getCollectionDocument = (0, graphql_admin_1.graphql)(`
        query GetCollection($id: ID, $slug: String, $variantListOptions: ProductVariantListOptions) {
            collection(id: $id, slug: $slug) {
                ...Collection
                productVariants(options: $variantListOptions) {
                    items {
                        id
                        name
                        price
                    }
                }
            }
        }
    `, [fragments_admin_1.collectionFragment]);
exports.getFacetWithValuesDocument = (0, graphql_admin_1.graphql)(`
        query GetFacetWithValues($id: ID!) {
            facet(id: $id) {
                ...FacetWithValues
            }
        }
    `, [fragments_admin_1.facetWithValuesFragment]);
exports.getFacetWithValueListDocument = (0, graphql_admin_1.graphql)(`
        query GetFacetWithValueList($id: ID!, $options: FacetValueListOptions) {
            facet(id: $id) {
                id
                languageCode
                isPrivate
                code
                name
                valueList(options: $options) {
                    items {
                        ...FacetValue
                    }
                    totalItems
                }
            }
        }
    `, [fragments_admin_1.facetValueFragment]);
exports.getFacetValuesDocument = (0, graphql_admin_1.graphql)(`
        query GetFacetValues($options: FacetValueListOptions) {
            facetValues(options: $options) {
                items {
                    ...FacetValue
                }
                totalItems
            }
        }
    `, [fragments_admin_1.facetValueFragment]);
exports.getFacetValueDocument = (0, graphql_admin_1.graphql)(`
        query GetFacetValue($id: ID!) {
            facetValue(id: $id) {
                ...FacetValue
            }
        }
    `, [fragments_admin_1.facetValueFragment]);
exports.getPromotionDocument = (0, graphql_admin_1.graphql)(`
        query GetPromotion($id: ID!) {
            promotion(id: $id) {
                ...Promotion
            }
        }
    `, [fragments_admin_1.promotionFragment]);
exports.getOrderListDocument = (0, graphql_admin_1.graphql)(`
    query GetOrderList($options: OrderListOptions) {
        orders(options: $options) {
            items {
                id
                code
                state
                total
                totalWithTax
                totalQuantity
                customer {
                    id
                    emailAddress
                    lastName
                }
            }
            totalItems
        }
    }
`);
exports.getOrderWithPaymentsDocument = (0, graphql_admin_1.graphql)(`
    query GetOrderWithPayments($id: ID!) {
        order(id: $id) {
            id
            payments {
                id
                errorMessage
                metadata
                refunds {
                    id
                    total
                }
            }
        }
    }
`);
exports.getOrderListWithQtyDocument = (0, graphql_admin_1.graphql)(`
    query GetOrderListWithQty($options: OrderListOptions) {
        orders(options: $options) {
            items {
                id
                code
                totalQuantity
                lines {
                    id
                    quantity
                }
            }
        }
    }
`);
exports.refundOrderDocument = (0, graphql_admin_1.graphql)(`
        mutation RefundOrder($input: RefundOrderInput!) {
            refundOrder(input: $input) {
                ...Refund
                ... on ErrorResult {
                    errorCode
                    message
                }
            }
        }
    `, [fragments_admin_1.refundFragment]);
exports.settleRefundDocument = (0, graphql_admin_1.graphql)(`
        mutation SettleRefund($input: SettleRefundInput!) {
            settleRefund(input: $input) {
                ...Refund
                ... on ErrorResult {
                    errorCode
                    message
                }
            }
        }
    `, [fragments_admin_1.refundFragment]);
exports.addNoteToOrderDocument = (0, graphql_admin_1.graphql)(`
    mutation AddNoteToOrder($input: AddNoteToOrderInput!) {
        addNoteToOrder(input: $input) {
            id
        }
    }
`);
exports.updateOrderNoteDocument = (0, graphql_admin_1.graphql)(`
    mutation UpdateOrderNote($input: UpdateOrderNoteInput!) {
        updateOrderNote(input: $input) {
            id
            data
            isPublic
        }
    }
`);
exports.deleteOrderNoteDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteOrderNote($id: ID!) {
        deleteOrderNote(id: $id) {
            result
            message
        }
    }
`);
exports.getOrderLineFulfillmentsDocument = (0, graphql_admin_1.graphql)(`
    query GetOrderLineFulfillments($id: ID!) {
        order(id: $id) {
            id
            lines {
                id
                fulfillmentLines {
                    fulfillment {
                        id
                        state
                    }
                    orderLineId
                    quantity
                }
            }
        }
    }
`);
exports.getOrderListFulfillmentsDocument = (0, graphql_admin_1.graphql)(`
    query GetOrderListFulfillments {
        orders {
            items {
                id
                state
                fulfillments {
                    id
                    state
                    nextStates
                    method
                }
            }
        }
    }
`);
exports.cancelPaymentDocument = (0, graphql_admin_1.graphql)(`
        mutation CancelPayment($paymentId: ID!) {
            cancelPayment(id: $paymentId) {
                ...Payment
                ... on ErrorResult {
                    errorCode
                    message
                }
                ... on PaymentStateTransitionError {
                    transitionError
                }
                ... on CancelPaymentError {
                    paymentErrorMessage
                }
            }
        }
    `, [fragments_admin_1.paymentFragment]);
exports.setOrderCustomerDocument = (0, graphql_admin_1.graphql)(`
    mutation SetOrderCustomer($input: SetOrderCustomerInput!) {
        setOrderCustomer(input: $input) {
            id
            customer {
                id
            }
        }
    }
`);
exports.getOrderAssetEdgeCaseDocument = (0, graphql_admin_1.graphql)(`
    query OrderAssetEdgeCase($id: ID!) {
        order(id: $id) {
            lines {
                id
            }
            id
            lines {
                id
                featuredAsset {
                    preview
                }
            }
        }
    }
`);
exports.getOrderWithLineCalculatedPropsDocument = (0, graphql_admin_1.graphql)(`
    query GetOrderWithLineCalculatedProps($id: ID!) {
        order(id: $id) {
            id
            lines {
                id
                linePriceWithTax
                quantity
            }
        }
    }
`);
exports.addManualPaymentDocument = (0, graphql_admin_1.graphql)(`
    mutation AddManualPaymentToOrder($input: ManualPaymentInput!) {
        addManualPaymentToOrder(input: $input) {
            ... on Order {
                id
                code
                state
                active
                total
                totalWithTax
                lines {
                    id
                }
                payments {
                    id
                    state
                }
            }
            ... on ErrorResult {
                errorCode
                message
            }
        }
    }
`);
exports.modifyOrderDocument = (0, graphql_admin_1.graphql)(`
        mutation ModifyOrder($input: ModifyOrderInput!) {
            modifyOrder(input: $input) {
                ...OrderWithModifications
                ... on ErrorResult {
                    errorCode
                    message
                }
            }
        }
    `, [fragments_admin_1.orderWithModificationsFragment]);
exports.addManualPaymentToOrderDocument = (0, graphql_admin_1.graphql)(`
        mutation AddManualPayment($input: ManualPaymentInput!) {
            addManualPaymentToOrder(input: $input) {
                ...OrderWithModifications
                ... on ErrorResult {
                    errorCode
                    message
                }
            }
        }
    `, [fragments_admin_1.orderWithModificationsFragment]);
exports.getOrderWithModificationsDocument = (0, graphql_admin_1.graphql)(`
        query GetOrderWithModifications($id: ID!) {
            order(id: $id) {
                ...OrderWithModifications
            }
        }
    `, [fragments_admin_1.orderWithModificationsFragment]);
exports.getOrderWithCustomFieldsDocument = (0, graphql_admin_1.graphql)(`
    query GetOrderCustomFields($id: ID!) {
        order(id: $id) {
            # Ignore error - customFields are dynamically generated at runtime, not in introspection schema
            customFields {
                points
            }
            lines {
                id
                # Ignore error - customFields are dynamically generated at runtime, not in introspection schema
                customFields {
                    color
                }
            }
        }
    }
`);
exports.getSettingsStoreValueDocument = (0, graphql_admin_1.graphql)(`
    query GetSettingsStoreValue($key: String!) {
        getSettingsStoreValue(key: $key)
    }
`);
exports.getSettingsStoreValuesDocument = (0, graphql_admin_1.graphql)(`
    query GetSettingsStoreValues($keys: [String!]!) {
        getSettingsStoreValues(keys: $keys)
    }
`);
exports.setSettingsStoreValueDocument = (0, graphql_admin_1.graphql)(`
    mutation SetSettingsStoreValue($input: SettingsStoreInput!) {
        setSettingsStoreValue(input: $input) {
            key
            result
            error
        }
    }
`);
exports.setSettingsStoreValuesDocument = (0, graphql_admin_1.graphql)(`
    mutation SetSettingsStoreValues($inputs: [SettingsStoreInput!]!) {
        setSettingsStoreValues(inputs: $inputs) {
            key
            result
            error
        }
    }
`);
exports.getCheckersDocument = (0, graphql_admin_1.graphql)(`
    query GetCheckers {
        shippingEligibilityCheckers {
            code
            args {
                defaultValue
                description
                label
                list
                name
                required
                type
            }
        }
    }
`);
exports.getZonesDocument = (0, graphql_admin_1.graphql)(`
    query GetZones($options: ZoneListOptions) {
        zones(options: $options) {
            items {
                id
                name
            }
            totalItems
        }
    }
`);
exports.getZoneDocument = (0, graphql_admin_1.graphql)(`
        query GetZone($id: ID!) {
            zone(id: $id) {
                ...Zone
            }
        }
    `, [fragments_admin_1.zoneFragment]);
exports.getActiveChannelWithZoneMembersDocument = (0, graphql_admin_1.graphql)(`
    query GetActiveChannelWithZoneMembers {
        activeChannel {
            id
            defaultShippingZone {
                id
                members {
                    name
                }
            }
        }
    }
`);
exports.createZoneDocument = (0, graphql_admin_1.graphql)(`
        mutation CreateZone($input: CreateZoneInput!) {
            createZone(input: $input) {
                ...Zone
            }
        }
    `, [fragments_admin_1.zoneFragment]);
exports.updateZoneDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdateZone($input: UpdateZoneInput!) {
            updateZone(input: $input) {
                ...Zone
            }
        }
    `, [fragments_admin_1.zoneFragment]);
exports.deleteZoneDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteZone($id: ID!) {
        deleteZone(id: $id) {
            result
            message
        }
    }
`);
exports.addMembersToZoneDocument = (0, graphql_admin_1.graphql)(`
        mutation AddMembersToZone($zoneId: ID!, $memberIds: [ID!]!) {
            addMembersToZone(zoneId: $zoneId, memberIds: $memberIds) {
                ...Zone
            }
        }
    `, [fragments_admin_1.zoneFragment]);
exports.removeMembersFromZoneDocument = (0, graphql_admin_1.graphql)(`
        mutation RemoveMembersFromZone($zoneId: ID!, $memberIds: [ID!]!) {
            removeMembersFromZone(zoneId: $zoneId, memberIds: $memberIds) {
                ...Zone
            }
        }
    `, [fragments_admin_1.zoneFragment]);
exports.getProductWithCustomFieldsDocument = (0, graphql_admin_1.graphql)(`
    query GetProductWithCustomFields($id: ID!) {
        product(id: $id) {
            id
            customFields {
                publicField
                authenticatedField
                updateProductField
                updateProductOrCustomerField
                superadminField
            }
        }
    }
`);
exports.getProductWithPublicCustomFieldsDocument = (0, graphql_admin_1.graphql)(`
    query GetProductWithPublicCustomFields($id: ID!) {
        product(id: $id) {
            id
            customFields {
                publicField
                authenticatedField
                updateProductField
            }
        }
    }
`);
exports.authenticateDocument = (0, graphql_admin_1.graphql)(`
        mutation Authenticate($input: AuthenticationInput!) {
            authenticate(input: $input) {
                ...CurrentUser
                ... on InvalidCredentialsError {
                    authenticationError
                    errorCode
                    message
                }
            }
        }
    `, [fragments_admin_1.currentUserFragment]);
exports.getCustomersDocument = (0, graphql_admin_1.graphql)(`
    query GetCustomers {
        customers {
            totalItems
            items {
                id
                emailAddress
            }
        }
    }
`);
exports.getCustomerUserAuthDocument = (0, graphql_admin_1.graphql)(`
    query GetCustomerUserAuth($id: ID!) {
        customer(id: $id) {
            id
            user {
                id
                verified
                authenticationMethods {
                    id
                    strategy
                }
            }
        }
    }
`);
exports.updatePromotionDocument = (0, graphql_admin_1.graphql)(`
        mutation UpdatePromotion($input: UpdatePromotionInput!) {
            updatePromotion(input: $input) {
                ...Promotion
                ... on ErrorResult {
                    errorCode
                    message
                }
            }
        }
    `, [fragments_admin_1.promotionFragment]);
exports.getPromotionListDocument = (0, graphql_admin_1.graphql)(`
        query GetPromotionList($options: PromotionListOptions) {
            promotions(options: $options) {
                items {
                    ...Promotion
                }
                totalItems
            }
        }
    `, [fragments_admin_1.promotionFragment]);
exports.configurableOperationDefFragment = (0, graphql_admin_1.graphql)(`
    fragment ConfigurableOperationDef on ConfigurableOperationDefinition {
        args {
            name
            type
            ui
        }
        code
        description
    }
`);
exports.getAdjustmentOperationsDocument = (0, graphql_admin_1.graphql)(`
        query GetAdjustmentOperations {
            promotionActions {
                ...ConfigurableOperationDef
            }
            promotionConditions {
                ...ConfigurableOperationDef
            }
        }
    `, [exports.configurableOperationDefFragment]);
exports.getCustomerWithUserDocument = (0, graphql_admin_1.graphql)(`
    query GetCustomerWithUser($id: ID!) {
        customer(id: $id) {
            id
            user {
                id
                identifier
                verified
            }
        }
    }
`);
exports.getCustomerOrdersDocument = (0, graphql_admin_1.graphql)(`
    query GetCustomerOrders($id: ID!) {
        customer(id: $id) {
            orders {
                items {
                    id
                }
                totalItems
            }
        }
    }
`);
exports.addNoteToCustomerDocument = (0, graphql_admin_1.graphql)(`
        mutation AddNoteToCustomer($input: AddNoteToCustomerInput!) {
            addNoteToCustomer(input: $input) {
                ...Customer
            }
        }
    `, [fragments_admin_1.customerFragment]);
exports.deleteCustomerAddressDocument = (0, graphql_admin_1.graphql)(`
    mutation DeleteCustomerAddress($id: ID!) {
        deleteCustomerAddress(id: $id) {
            success
        }
    }
`);
//# sourceMappingURL=shared-definitions.js.map