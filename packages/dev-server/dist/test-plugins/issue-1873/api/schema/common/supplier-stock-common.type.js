"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierStockCommonType = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.supplierStockCommonType = (0, graphql_tag_1.default) `
  enum SupplierStockAdjustType {
    STOCK_REAL
    STOCK_VIRTUAL
    STOCK_BOTH
    STOCK_IN_TRANSIT
    STOCK_TRANSIT_TO_STOCK
    NONE
  }
`;
//# sourceMappingURL=supplier-stock-common.type.js.map