"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierStockType = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.supplierStockType = (0, graphql_tag_1.default) `
  type SupplierStock implements Node {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    stockOnHand: Int!
    virtualStock: Int!
    inTransitsStock: Int!
    stockArea: String
    productVariant: ProductVariant!
    productVariantId: ID!
    product: Product!
    productId: ID!
    comment: String
    enabled: Boolean!
    link: String
    tags: [String!]
  }

  type SupplierStockList implements PaginatedList {
    items: [SupplierStock!]!
    totalItems: Int!
  }
`;
//# sourceMappingURL=supplier-stock.type.js.map