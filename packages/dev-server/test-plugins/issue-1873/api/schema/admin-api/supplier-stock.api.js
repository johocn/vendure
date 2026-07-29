"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierStockApi = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.supplierStockApi = (0, graphql_tag_1.default) `
  extend type Query {
    "Query all supplierStock list"
    supplierStocks(options: SupplierStockListOptions): SupplierStockList!
  }

  extend type Mutation {
    initializeDemo: Boolean
  }

  input SupplierStockListOptions
`;
//# sourceMappingURL=supplier-stock.api.js.map