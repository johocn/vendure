"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.digitalFulfillmentHandler = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
let connection;
/**
 * @description
 * This is a fulfillment handler for digital products which generates a download url
 * for each digital product in the order.
 */
exports.digitalFulfillmentHandler = new core_1.FulfillmentHandler({
    code: 'digital-fulfillment',
    description: [
        {
            languageCode: core_1.LanguageCode.en,
            value: 'Generates product keys for the digital download',
        },
    ],
    args: {},
    init: injector => {
        connection = injector.get(core_1.TransactionalConnection);
    },
    createFulfillment: async (ctx, orders, lines) => {
        const digitalDownloadUrls = [];
        const orderLines = await connection.getRepository(ctx, core_1.OrderLine).find({
            where: {
                id: (0, typeorm_1.In)(lines.map(l => l.orderLineId)),
            },
            relations: {
                productVariant: true,
            },
        });
        for (const orderLine of orderLines) {
            if (orderLine.productVariant.customFields.isDigital) {
                // This is a digital product, so generate a download url
                const downloadUrl = await generateDownloadUrl(orderLine);
                digitalDownloadUrls.push(downloadUrl);
            }
        }
        return {
            method: 'Digital Fulfillment',
            trackingCode: 'DIGITAL',
            customFields: {
                downloadUrls: digitalDownloadUrls,
            },
        };
    },
});
function generateDownloadUrl(orderLine) {
    // This is a dummy function that would generate a download url for the given OrderLine
    // by interfacing with some external system that manages access to the digital product.
    // In this example, we just generate a random string.
    const downloadUrl = `https://example.com/download?key=${Math.random().toString(36).substring(7)}`;
    return Promise.resolve(downloadUrl);
}
//# sourceMappingURL=digital-fulfillment-handler.js.map