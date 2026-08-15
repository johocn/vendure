import { Checkbox } from '@/vdb/components/ui/checkbox.js';
import { Input } from '@/vdb/components/ui/input.js';
import { Label } from '@/vdb/components/ui/label.js';
import { Textarea } from '@/vdb/components/ui/textarea.js';

export interface FieldSpec {
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'boolean' | 'stringList' | 'password';
}
export interface FieldSection {
    group: string;
    fields: FieldSpec[];
}
export type Fields = Array<FieldSpec | FieldSection>;

// 点路径读写嵌套对象（如 "invoiceHeader.companyName"）
export function deepGet(obj: any, path: string): any {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function deepSet(obj: any, path: string, value: any): any {
    const keys = path.split('.');
    const out = { ...(obj ?? {}) };
    let cur = out;
    for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = cur[keys[i]] ?? {};
        cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    return out;
}

export function SettingsForm({ fields, values, onChange }: {
    fields: Fields;
    values: Record<string, any>;
    onChange: (v: Record<string, any>) => void;
}) {
    const set = (name: string, value: any) => onChange(deepSet(values, name, value));

    const renderField = (f: FieldSpec) => {
        const id = f.name;
        const value = deepGet(values, f.name);
        switch (f.type) {
            case 'boolean':
                return (
                    <div key={id} className="flex items-center gap-2 py-1">
                        <Checkbox id={id} checked={!!value} onCheckedChange={(v) => set(f.name, !!v)} />
                        <Label htmlFor={id}>{f.label}</Label>
                    </div>
                );
            case 'textarea':
                return (
                    <div key={id} className="grid gap-1 py-1">
                        <Label htmlFor={id}>{f.label}</Label>
                        <Textarea id={id} value={value ?? ''} onChange={(e) => set(f.name, e.target.value)} />
                    </div>
                );
            case 'stringList':
                return (
                    <div key={id} className="grid gap-1 py-1">
                        <Label htmlFor={id}>{f.label}</Label>
                        <Textarea
                            id={id}
                            value={(value ?? []).join('\n')}
                            onChange={(e) => set(f.name, e.target.value.split('\n').filter(Boolean))}
                        />
                        <p className="text-xs text-muted-foreground">每行一项</p>
                    </div>
                );
            case 'password':
                return (
                    <div key={id} className="grid gap-1 py-1">
                        <Label htmlFor={id}>{f.label}</Label>
                        <Input id={id} type="password" value={value ?? ''} onChange={(e) => set(f.name, e.target.value)} />
                    </div>
                );
            default:
                return (
                    <div key={id} className="grid gap-1 py-1">
                        <Label htmlFor={id}>{f.label}</Label>
                        <Input id={id} value={value ?? ''} onChange={(e) => set(f.name, e.target.value)} />
                    </div>
                );
        }
    };

    return (
        <div>
            {fields.map((entry) =>
                'group' in entry ? (
                    <fieldset key={entry.group} className="mb-4">
                        <legend className="font-semibold">{entry.group}</legend>
                        {entry.fields.map(renderField)}
                    </fieldset>
                ) : (
                    renderField(entry)
                ),
            )}
        </div>
    );
}