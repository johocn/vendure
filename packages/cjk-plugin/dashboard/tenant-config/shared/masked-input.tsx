import { useState, useEffect } from 'react';

interface Props {
    label: string;
    value?: string;
    onCommit: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export function MaskedInput({ label, value, onCommit, placeholder, disabled }: Props) {
    const [local, setLocal] = useState('');
    const [hasOriginal] = useState(Boolean(value));
    useEffect(() => { setLocal(''); }, [value]);
    const display = hasOriginal && !local ? '********' : local;
    return (
        <div>
            <label>{label}</label>
            <input
                type="text"
                value={display}
                placeholder={placeholder || (hasOriginal ? '留空保存表示保留原值' : '')}
                disabled={disabled}
                onChange={e => setLocal(e.target.value)}
                onBlur={() => {
                    if (!hasOriginal) { if (local) onCommit(local); }
                    else if (local === '') onCommit('***'); // 保留
                    else onCommit(local);
                }}
            />
            {hasOriginal && !disabled && (
                <button type="button" onClick={() => onCommit('')}>清空</button>
            )}
        </div>
    );
}
