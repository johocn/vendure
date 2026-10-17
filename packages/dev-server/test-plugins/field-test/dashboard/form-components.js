"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlugInputComponent = exports.TagsInputComponent = exports.MultiCurrencyInputComponent = exports.EmailInputComponent = exports.MarkdownEditorComponent = exports.ColorPickerComponent = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const dashboard_1 = require("@vendure/dashboard");
const lucide_react_1 = require("lucide-react");
const react_1 = require("react");
const react_hook_form_1 = require("react-hook-form");
const ColorPickerComponent = ({ value, onChange, name }) => {
    const [isOpen, setIsOpen] = (0, react_1.useState)(false);
    const { getFieldState } = (0, react_hook_form_1.useFormContext)();
    const error = getFieldState(name).error;
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'];
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(dashboard_1.Button, { type: "button", variant: "outline", size: "icon", className: (0, dashboard_1.cn)('w-8 h-8 border-2 border-gray-300 p-0', error && 'border-red-500'), style: { backgroundColor: error ? 'transparent' : value || '#ffffff' }, onClick: () => setIsOpen(!isOpen) }), (0, jsx_runtime_1.jsx)(dashboard_1.Input, { value: value || '', onChange: e => onChange(e.target.value), placeholder: "#ffffff" })] }), isOpen && ((0, jsx_runtime_1.jsx)(dashboard_1.Card, { children: (0, jsx_runtime_1.jsx)(dashboard_1.CardContent, { className: "grid grid-cols-4 gap-2 p-2", children: colors.map(color => ((0, jsx_runtime_1.jsx)(dashboard_1.Button, { type: "button", variant: "outline", size: "icon", className: "w-8 h-8 border-2 border-gray-300 hover:border-gray-500 p-0", style: { backgroundColor: color }, onClick: () => {
                            onChange(color);
                            setIsOpen(false);
                        } }, color))) }) }))] }));
};
exports.ColorPickerComponent = ColorPickerComponent;
const MarkdownEditorComponent = props => {
    const { getFieldState } = (0, react_hook_form_1.useFormContext)();
    const fieldState = getFieldState(props.name);
    return ((0, jsx_runtime_1.jsx)(dashboard_1.Textarea, { className: "font-mono", ref: props.ref, onBlur: props.onBlur, value: props.value, onChange: e => props.onChange(e.target.value), disabled: props.disabled }));
};
exports.MarkdownEditorComponent = MarkdownEditorComponent;
const EmailInputComponent = ({ name, value, onChange, disabled }) => {
    const { getFieldState } = (0, react_hook_form_1.useFormContext)();
    const isValid = getFieldState(name).invalid === false;
    return ((0, jsx_runtime_1.jsx)(dashboard_1.AffixedInput, { prefix: (0, jsx_runtime_1.jsx)(lucide_react_1.Mail, { className: "h-4 w-4 text-muted-foreground" }), suffix: value &&
            (isValid ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Check, { className: "h-4 w-4 text-green-500" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4 text-red-500" }))), value: value || '', onChange: e => onChange(e.target.value), disabled: disabled, placeholder: "Enter email address", className: "pl-10 pr-10", name: name }));
};
exports.EmailInputComponent = EmailInputComponent;
const MultiCurrencyInputComponent = ({ value, onChange, disabled, name }) => {
    const [currency, setCurrency] = (0, react_1.useState)('USD');
    const { formatCurrencyName } = (0, dashboard_1.useLocalFormat)();
    const currencies = [
        { code: 'USD', symbol: '$', rate: 1 },
        { code: 'EUR', symbol: '€', rate: 0.85 },
        { code: 'GBP', symbol: '£', rate: 0.73 },
        { code: 'JPY', symbol: '¥', rate: 110 },
    ];
    const selectedCurrency = currencies.find(c => c.code === currency) || currencies[0];
    // Convert price based on exchange rate
    const displayValue = value ? (value * selectedCurrency.rate).toFixed(2) : '';
    const handleChange = (val) => {
        const numericValue = parseFloat(val) || 0;
        // Convert back to base currency (USD) for storage
        const baseValue = numericValue / selectedCurrency.rate;
        onChange(baseValue);
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex space-x-2", children: [(0, jsx_runtime_1.jsxs)(dashboard_1.Select, { value: currency, onValueChange: setCurrency, disabled: disabled, children: [(0, jsx_runtime_1.jsx)(dashboard_1.SelectTrigger, { className: "w-24", children: (0, jsx_runtime_1.jsx)(dashboard_1.SelectValue, { children: (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-1", children: currency }) }) }), (0, jsx_runtime_1.jsx)(dashboard_1.SelectContent, { children: currencies.map(curr => {
                            return ((0, jsx_runtime_1.jsx)(dashboard_1.SelectItem, { value: curr.code, children: (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-2", children: formatCurrencyName(curr.code) }) }, curr.code));
                        }) })] }), (0, jsx_runtime_1.jsx)(dashboard_1.AffixedInput, { prefix: selectedCurrency.symbol, value: displayValue, onChange: e => onChange(e.target.value), disabled: disabled, placeholder: "0.00", className: "pl-8", name: name })] }));
};
exports.MultiCurrencyInputComponent = MultiCurrencyInputComponent;
const TagsInputComponent = ({ value, onChange, disabled, name, onBlur }) => {
    const [inputValue, setInputValue] = (0, react_1.useState)('');
    // Parse tags from string value (comma-separated)
    const tags = value ? value.split(',').filter(Boolean) : [];
    const addTag = (tag) => {
        const trimmedTag = tag.trim();
        if (trimmedTag && !tags.includes(trimmedTag)) {
            const newTags = [...tags, trimmedTag];
            onChange(newTags.join(','));
        }
        setInputValue('');
    };
    const removeTag = (tagToRemove) => {
        const newTags = tags.filter(tag => tag !== tagToRemove);
        onChange(newTags.join(','));
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(inputValue);
        }
        else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-1", children: tags.map((tag, index) => ((0, jsx_runtime_1.jsxs)(dashboard_1.Badge, { variant: "secondary", className: "gap-1", children: [tag, (0, jsx_runtime_1.jsx)(dashboard_1.Button, { type: "button", variant: "ghost", size: "icon", className: "h-4 w-4 p-0 hover:bg-transparent", onClick: () => removeTag(tag), disabled: disabled, children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-3 w-3" }) })] }, index))) }), (0, jsx_runtime_1.jsx)(dashboard_1.Input, { value: inputValue, onChange: e => setInputValue(e.target.value), onKeyDown: handleKeyDown, onBlur: onBlur, disabled: disabled, placeholder: "Type a tag and press Enter or comma", name: name })] }));
};
exports.TagsInputComponent = TagsInputComponent;
const SlugInputComponent = ({ value, onChange, disabled, name }) => {
    const [autoGenerate, setAutoGenerate] = (0, react_1.useState)(!value);
    const [isGenerating, setIsGenerating] = (0, react_1.useState)(false);
    const { watch } = (0, react_hook_form_1.useFormContext)();
    const nameValue = watch('translations.0.name');
    const generateSlug = (text) => {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9 -]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .trim('-'); // Remove leading/trailing hyphens
    };
    (0, react_1.useEffect)(() => {
        if (autoGenerate && nameValue) {
            const newSlug = generateSlug(nameValue);
            if (newSlug !== value) {
                onChange(newSlug);
            }
        }
    }, [nameValue, autoGenerate, onChange, value]);
    const handleManualGenerate = async () => {
        if (!nameValue)
            return;
        setIsGenerating(true);
        // Simulate API call for slug validation/generation
        await new Promise(resolve => setTimeout(resolve, 500));
        const newSlug = generateSlug(nameValue);
        onChange(newSlug);
        setIsGenerating(false);
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(dashboard_1.Input, { value: value || '', onChange: e => onChange(e.target.value), disabled: disabled || autoGenerate, placeholder: "product-slug", className: "flex-1", name: name }), (0, jsx_runtime_1.jsx)(dashboard_1.Button, { type: "button", variant: "outline", size: "icon", disabled: disabled || !nameValue || isGenerating, onClick: handleManualGenerate, children: (0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCw, { className: `h-4 w-4 ${isGenerating ? 'animate-spin' : ''}` }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(dashboard_1.Switch, { checked: autoGenerate, onCheckedChange: setAutoGenerate, disabled: disabled }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-1 text-sm text-muted-foreground", children: [autoGenerate ? (0, jsx_runtime_1.jsx)(lucide_react_1.Lock, { className: "h-3 w-3" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Unlock, { className: "h-3 w-3" }), (0, jsx_runtime_1.jsx)("span", { children: "Auto-generate from name" })] })] })] }));
};
exports.SlugInputComponent = SlugInputComponent;
//# sourceMappingURL=form-components.js.map