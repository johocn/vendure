"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierStockInTransitApi = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.supplierStockInTransitApi = (0, graphql_tag_1.default) `
  extend type Query {
    "Query all SupplierStockInTransit list"
    supplierStockInTransits(
      options: SupplierStockInTransitListOptions
    ): SupplierStockInTransitList!
  }
  input SupplierStockInTransitListOptions
`;
//# sourceMappingURL=supplier-stock-intransit.api.js.map