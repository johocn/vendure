"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WishlistService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const wishlist_item_entity_1 = require("../entities/wishlist-item.entity");
let WishlistService = class WishlistService {
    constructor(connection, productVariantService) {
        this.connection = connection;
        this.productVariantService = productVariantService;
    }
    async getWishlistItems(ctx) {
        try {
            const customer = await this.getCustomerWithWishlistItems(ctx);
            return customer.customFields.wishlistItems;
        }
        catch (err) {
            return [];
        }
    }
    /**
     * Adds a new item to the active Customer's wishlist.
     */
    async addItem(ctx, variantId) {
        const customer = await this.getCustomerWithWishlistItems(ctx);
        const variant = await this.productVariantService.findOne(ctx, variantId);
        if (!variant) {
            throw new core_1.UserInputError(`No ProductVariant with the id ${variantId} could be found`);
        }
        const existingItem = customer.customFields.wishlistItems.find(i => i.productVariantId === variantId);
        if (existingItem) {
            // Item already exists in wishlist, do not
            // add it again
            return customer.customFields.wishlistItems;
        }
        const wishlistItem = await this.connection
            .getRepository(ctx, wishlist_item_entity_1.WishlistItem)
            .save(new wishlist_item_entity_1.WishlistItem({ productVariantId: variantId }));
        customer.customFields.wishlistItems.push(wishlistItem);
        await this.connection.getRepository(ctx, core_1.Customer).save(customer, { reload: false });
        return this.getWishlistItems(ctx);
    }
    /**
     * Removes an item from the active Customer's wishlist.
     */
    async removeItem(ctx, itemId) {
        const customer = await this.getCustomerWithWishlistItems(ctx);
        const itemToRemove = customer.customFields.wishlistItems.find(i => i.id === itemId);
        if (itemToRemove) {
            await this.connection.getRepository(ctx, wishlist_item_entity_1.WishlistItem).remove(itemToRemove);
            customer.customFields.wishlistItems = customer.customFields.wishlistItems.filter(i => i.id !== itemId);
        }
        await this.connection.getRepository(ctx, core_1.Customer).save(customer);
        return this.getWishlistItems(ctx);
    }
    /**
     * Gets the active Customer from the context and loads the wishlist items.
     */
    async getCustomerWithWishlistItems(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.ForbiddenError();
        }
        const customer = await this.connection.getRepository(ctx, core_1.Customer).findOne({
            where: { user: { id: ctx.activeUserId } },
            relations: {
                customFields: {
                    wishlistItems: {
                        productVariant: true,
                    },
                },
            },
        });
        if (!customer) {
            throw new core_1.InternalServerError(`Customer was not found`);
        }
        return customer;
    }
};
exports.WishlistService = WishlistService;
exports.WishlistService = WishlistService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ProductVariantService])
], WishlistService);
//# sourceMappingURL=wishlist.service.js.map