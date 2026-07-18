"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierStockInTransitType = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.supplierStockInTransitType = (0, graphql_tag_1.default) `
  type SupplierStockInTransit implements Node {
    id: ID!
    quantity: Int!
    channelName: String
    channelOrderNo: String!
    supplierStock: SupplierStock!
    supplierStockId: ID!
  }

  type SupplierStockInTransitList implements PaginatedList {
    items: [SupplierStockInTransit!]!
    totalItems: Int!
  }
`;
//# sourceMappingURL=supplier-stock-in-transit.type.js.map