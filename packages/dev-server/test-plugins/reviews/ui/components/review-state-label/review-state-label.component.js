"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewStateLabelComponent = void 0;
const core_1 = require("@angular/core");
const core_2 = require("@vendure/admin-ui/core");
let ReviewStateLabelComponent = class ReviewStateLabelComponent {
    getIcon(state) {
        switch (state) {
            case 'new':
                return 'bubble-exclamation';
            case 'approved':
                return 'check-circle';
            case 'rejected':
                return 'times-circle';
        }
    }
};
exports.ReviewStateLabelComponent = ReviewStateLabelComponent;
__decorate([
    (0, core_1.Input)(),
    __metadata("design:type", String)
], ReviewStateLabelComponent.prototype, "state", void 0);
exports.ReviewStateLabelComponent = ReviewStateLabelComponent = __decorate([
    (0, core_1.Component)({
        selector: 'review-state-label',
        templateUrl: './review-state-label.component.html',
        styleUrls: ['./review-state-label.component.scss'],
        changeDetection: core_1.ChangeDetectionStrategy.OnPush,
        standalone: true,
        imports: [core_2.SharedModule],
    })
], ReviewStateLabelComponent);
//# sourceMappingURL=review-state-label.component.js.map