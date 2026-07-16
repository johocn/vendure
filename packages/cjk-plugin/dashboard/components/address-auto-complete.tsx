// e:\code\vendure\packages\cjk-plugin\dashboard\components\address-auto-complete.tsx
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface AddressAutoCompleteProps {
    value: string;
    onChange: (value: string) => void;
    onLocationSelect?: (location: { lng: number; lat: number }, name: string) => void;
    hasConfigured: boolean;
    placeholder?: string;
}

interface AutoCompleteItem {
    name: string;
    location: { lng: number; lat: number };
}

export function AddressAutoComplete({
    value,
    onChange,
    onLocationSelect,
    hasConfigured,
    placeholder,
}: AddressAutoCompleteProps) {
    const autoCompleteRef = useRef<any>(null);
    const [keyword, setKeyword] = useState(value ?? '');
    const [results, setResults] = useState<AutoCompleteItem[]>([]);
    const [open, setOpen] = useState(false);

    // 初始化 AutoComplete 实例（懒加载）
    useEffect(() => {
        if (!hasConfigured) return;
        const AMap = (window as any).AMap;
        if (!AMap) return;
        try {
            autoCompleteRef.current = new AMap.AutoComplete({ city: '全国' });
        } catch (err) {
            console.warn('AutoComplete plugin init failed', err);
        }
    }, [hasConfigured]);

    // 同步外部 value 变化（如逆地理编码回填）
    useEffect(() => {
        setKeyword(value ?? '');
    }, [value]);

    // 搜索（防抖 300ms + 最小 2 字符）
    useEffect(() => {
        if (!hasConfigured || !keyword || keyword.length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }
        if (!autoCompleteRef.current) return;
        const timer = setTimeout(() => {
            autoCompleteRef.current.search(keyword, (status: string, result: any) => {
                if (status === 'complete' && result.tips) {
                    const items: AutoCompleteItem[] = result.tips
                        .filter((t: any) => t.location)
                        .map((t: any) => ({
                            name: t.name,
                            location: { lng: t.location.lng, lat: t.location.lat },
                        }));
                    setResults(items);
                    setOpen(true);
                } else {
                    setResults([]);
                    setOpen(false);
                }
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [keyword, hasConfigured]);

    const handleSelect = (item: AutoCompleteItem) => {
        setKeyword(item.name);
        onChange(item.name);
        onLocationSelect?.(item.location, item.name);
        setOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setKeyword(e.target.value);
        onChange(e.target.value);
    };

    // 未配置地图服务时降级为普通 input
    if (!hasConfigured) {
        return (
            <input
                type="text"
                value={keyword}
                onChange={handleInputChange}
                placeholder={placeholder}
                className="w-full border rounded px-2 py-1 text-sm"
            />
        );
    }

    return (
        <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
                type="text"
                value={keyword}
                onChange={handleInputChange}
                placeholder={placeholder}
                className="w-full border rounded pl-8 pr-2 py-1 text-sm"
            />
            {open && results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow max-h-60 overflow-auto">
                    {results.map((item, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelect(item)}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-muted/30 border-b last:border-b-0"
                        >
                            {item.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
