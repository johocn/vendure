"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminApiExtensions = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const common_1 = require("../common");
const supplier_stock_intransit_api_1 = require("./supplier-stock-intransit.api");
const supplier_stock_api_1 = require("./supplier-stock.api");
exports.adminApiExtensions = (0, graphql_tag_1.default) `
  ${common_1.supplierStockType}
  ${common_1.supplierStockInTransitType}
  ${common_1.supplierStockCommonType}

  ${supplier_stock_api_1.supplierStockApi}
  ${supplier_stock_intransit_api_1.supplierStockInTransitApi}
`;
//# sourceMappingURL=index.js.map