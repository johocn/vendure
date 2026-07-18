"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewStateSelect = exports.ReviewMultiSelect = exports.ReviewSingleSelect = exports.BodyInputComponent = exports.ResponseDisplay = exports.TextareaCustomField = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const dashboard_1 = require("@vendure/dashboard");
const graphql_1 = require("../../../graphql/graphql");
const TextareaCustomField = props => {
    return (0, jsx_runtime_1.jsx)(dashboard_1.Textarea, Object.assign({}, props, { rows: 4 }));
};
exports.TextareaCustomField = TextareaCustomField;
const ResponseDisplay = ({ value }) => {
    return (0, jsx_runtime_1.jsx)("div", { className: "font-mono", children: value });
};
exports.ResponseDisplay = ResponseDisplay;
const BodyInputComponent = props => {
    return (0, jsx_runtime_1.jsx)(dashboard_1.Textarea, Object.assign({}, props, { rows: 4 }));
};
exports.BodyInputComponent = BodyInputComponent;
const reviewFragment = (0, graphql_1.graphql)(`
    fragment Review on ProductReview {
        id
        summary
    }
`);
const reviewListQuery = (0, graphql_1.graphql)(`
        query GetReviewList($options: ProductReviewListOptions) {
            productReviews(options: $options) {
                items {
                    ...Review
                }
                totalItems
            }
        }
    `, [reviewFragment]);
const ReviewSingleSelect = props => {
    const config = {
        listQuery: reviewListQuery,
        labelKey: 'summary',
        idKey: 'id',
    };
    return (0, jsx_runtime_1.jsx)(dashboard_1.SingleRelationInput, Object.assign({}, props, { config: config }));
};
exports.ReviewSingleSelect = ReviewSingleSelect;
const ReviewMultiSelect = props => {
    const config = {
        listQuery: reviewListQuery,
        labelKey: 'summary',
        idKey: 'id',
    };
    return (0, jsx_runtime_1.jsx)(dashboard_1.MultiRelationInput, Object.assign({ config: config }, props));
};
exports.ReviewMultiSelect = ReviewMultiSelect;
const ReviewStateSelect = props => {
    return ((0, jsx_runtime_1.jsxs)(dashboard_1.Select, { value: props.value, onValueChange: props.onChange, children: [(0, jsx_runtime_1.jsx)(dashboard_1.SelectTrigger, { children: (0, jsx_runtime_1.jsx)(dashboard_1.SelectValue, { placeholder: "Select state..." }) }), (0, jsx_runtime_1.jsxs)(dashboard_1.SelectContent, { children: [(0, jsx_runtime_1.jsx)(dashboard_1.SelectItem, { value: "new", children: "New" }), (0, jsx_runtime_1.jsx)(dashboard_1.SelectItem, { value: "approved", children: "Approved" }), (0, jsx_runtime_1.jsx)(dashboard_1.SelectItem, { value: "rejected", children: "Rejected" })] })] }, props.value));
};
exports.ReviewStateSelect = ReviewStateSelect;
//# sourceMappingURL=custom-form-components.js.map