export interface InvoiceHeader {
    companyName?: string;
    taxNo?: string;
    invoiceAddress?: string;
    invoicePhone?: string;
    bankInfo?: string;
}

export interface ServiceContacts {
    phones?: string[];
    emails?: string[];
    wechats?: string[];
    wecomId?: string;
    onlineChatEnabled?: boolean;
}

export interface BasicConfig {
    tenantName?: string;
    contactPhone?: string;
    address?: string;
    invoiceHeader?: InvoiceHeader;
    serviceContacts?: ServiceContacts;
    timeZoneId?: string;
}