"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsApiExtensions = void 0;
exports.getApiExtensions = getApiExtensions;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.metricsApiExtensions = (0, graphql_tag_1.default) `
    type MetricSummary {
        interval: MetricInterval!
        type: MetricType!
        title: String!
        entries: [MetricSummaryEntry!]!
    }
    enum MetricInterval {
        Daily
    }
    enum MetricType {
        OrderCount
        OrderTotal
        AverageOrderValue
    }
    type MetricSummaryEntry {
        label: String!
        value: Float!
    }
    input MetricSummaryInput {
        interval: MetricInterval!
        types: [MetricType!]!
        refresh: Boolean
    }
    extend type Query {
        """
        Get metrics for the given interval and metric types.
        """
        metricSummary(input: MetricSummaryInput): [MetricSummary!]!
    }
`;
function getApiExtensions() {
    return exports.metricsApiExtensions;
}
//# sourceMappingURL=api-extensions.js.map