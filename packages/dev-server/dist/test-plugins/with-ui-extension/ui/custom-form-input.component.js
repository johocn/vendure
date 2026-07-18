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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginOptionCheckboxes = void 0;
const core_1 = require("@angular/core");
const core_2 = require("@vendure/admin-ui/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
let LoginOptionCheckboxes = class LoginOptionCheckboxes {
    constructor(dataService) {
        this.dataService = dataService;
        this.isListInput = true;
        this.readonly = false;
        this.data = [];
        this.defaultLoginOptions = ['sso', 'password', 'magicLink'];
        this.checkedOptions = [];
    }
    ngOnInit() {
        var _a;
        // this.data = JSON.parse(this.formControl.value);
        console.log('formControl', this.formControl);
        console.log('this.defaultLoginOptions', this.defaultLoginOptions);
        this.checkedOptions = [...((_a = this.formControl.value) !== null && _a !== void 0 ? _a : [])];
    }
    onCheckboxChange(event, option) {
        this.dataService
            .query((0, graphql_tag_1.default) `
                query GetCustomerAuthOptions {
                    customer {
                        id
                        customFields {
                            org {
                                authOptions
                            }
                        }
                    }
                }
            `)
            .single$.subscribe(data => {
            console.log('data', data);
        });
        if (this.checkedOptions.includes(option)) {
            this.checkedOptions = this.checkedOptions.filter(item => item !== option);
        }
        else {
            this.checkedOptions.push(option);
        }
        console.log('this.checkedOptions', this.checkedOptions);
        this.formControl.setValue(this.checkedOptions);
        this.formControl.markAsDirty();
    }
};
exports.LoginOptionCheckboxes = LoginOptionCheckboxes;
exports.LoginOptionCheckboxes = LoginOptionCheckboxes = __decorate([
    (0, core_1.Component)({
        template: `
        <div class="login-option-container">
            <div *ngFor="let option of defaultLoginOptions" class="login-option">
                <input
                    type="checkbox"
                    [id]="option"
                    [name]="option"
                    [value]="option"
                    [checked]="checkedOptions.includes(option)"
                    (change)="onCheckboxChange($event, option)"
                />
                <label>{{ option }}</label>
            </div>
        </div>
    `,
        // styleUrls: ['./module-styles/checkboxes-form-inputs.component.scss'],
    }),
    __metadata("design:paramtypes", [core_2.DataService])
], LoginOptionCheckboxes);
//# sourceMappingURL=custom-form-input.component.js.map