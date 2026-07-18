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
exports.ReviewHistogramComponent = void 0;
const core_1 = require("@angular/core");
const core_2 = require("@vendure/admin-ui/core");
const star_rating_component_1 = require("../star-rating/star-rating.component");
let ReviewHistogramComponent = class ReviewHistogramComponent {
    constructor() {
        this.binData = [];
        this.filterChange = new core_1.EventEmitter();
        this.bins = [5, 4, 3, 2, 1];
        this.filteredBin = null;
    }
    ngOnChanges() {
        this.max = this.binData ? Math.max(...this.binData.map(d => d.frequency)) : 0;
    }
    getPercentage(bin) {
        if (!this.binData) {
            return 0;
        }
        const data = this.binData.find(d => d.bin === bin);
        if (!data) {
            return 0;
        }
        return Math.round((data.frequency / this.max) * 100);
    }
    getFrequency(bin) {
        if (!this.binData) {
            return 0;
        }
        const data = this.binData.find(d => d.bin === bin);
        if (!data) {
            return 0;
        }
        return data.frequency;
    }
    toggleBinFilter(bin) {
        if (this.filteredBin === bin) {
            this.filteredBin = null;
        }
        else {
            this.filteredBin = bin;
        }
        this.filterChange.emit(this.filteredBin);
    }
};
exports.ReviewHistogramComponent = ReviewHistogramComponent;
__decorate([
    (0, core_1.Input)(),
    __metadata("design:type", Object)
], ReviewHistogramComponent.prototype, "binData", void 0);
__decorate([
    (0, core_1.Output)(),
    __metadata("design:type", Object)
], ReviewHistogramComponent.prototype, "filterChange", void 0);
exports.ReviewHistogramComponent = ReviewHistogramComponent = __decorate([
    (0, core_1.Component)({
        selector: 'review-histogram',
        templateUrl: './review-histogram.component.html',
        styleUrls: ['./review-histogram.component.scss'],
        changeDetection: core_1.ChangeDetectionStrategy.OnPush,
        standalone: true,
        imports: [core_2.SharedModule, star_rating_component_1.StarRatingComponent],
    })
], ReviewHistogramComponent);
//# sourceMappingURL=review-histogram.component.js.map