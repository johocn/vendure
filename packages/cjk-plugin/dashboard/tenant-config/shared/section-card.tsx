import { ReactNode } from 'react';

interface Props { title: string; children: ReactNode; }
export function SectionCard({ title, children }: Props) {
    return (
        <div style={{ border: '1px solid #e0e0e0', borderRadius: 4, padding: 16, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>{title}</h3>
            {children}
        </div>
    );
}
