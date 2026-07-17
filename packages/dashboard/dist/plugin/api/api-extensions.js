"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminApiExtensions = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.adminApiExtensions = (0, graphql_tag_1.default) `
    type DashboardMetricSummary {
        type: DashboardMetricType!
        title: String!
        entries: [DashboardMetricSummaryEntry!]!
    }
    enum DashboardMetricType {
        OrderCount
        OrderTotal
        AverageOrderValue
    }
    type DashboardMetricSummaryEntry {
        label: String!
        value: Float!
    }
    input DashboardMetricSummaryInput {
        types: [DashboardMetricType!]!
        refresh: Boolean
        startDate: DateTime!
        endDate: DateTime!
    }
    extend type Query {
        """
        Get metrics for the given date range and metric types.
        """
        dashboardMetricSummary(input: DashboardMetricSummaryInput): [DashboardMetricSummary!]!
    }
`;
