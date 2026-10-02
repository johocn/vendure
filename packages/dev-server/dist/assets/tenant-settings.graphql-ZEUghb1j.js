import{j as t,bu as o,a8 as r,g4 as p,dp as g}from"./index-BRWcz4T7.js";function h(u,i){return i.split(".").reduce((c,a)=>c?.[a],u)}function m(u,i,c){const a=i.split("."),l={...u??{}};let e=l;for(let n=0;n<a.length-1;n++)e[a[n]]=e[a[n]]??{},e=e[a[n]];return e[a[a.length-1]]=c,l}function j({fields:u,values:i,onChange:c}){const a=(e,n)=>c(m(i,e,n)),l=e=>{const n=e.name,d=h(i,e.name);switch(e.type){case"boolean":return t.jsxs("div",{className:"flex items-center gap-2 py-1",children:[t.jsx(g,{id:n,checked:!!d,onCheckedChange:s=>a(e.name,!!s)}),t.jsx(o,{htmlFor:n,children:e.label})]},n);case"textarea":return t.jsxs("div",{className:"grid gap-1 py-1",children:[t.jsx(o,{htmlFor:n,children:e.label}),t.jsx(p,{id:n,value:d??"",onChange:s=>a(e.name,s.target.value)})]},n);case"stringList":return t.jsxs("div",{className:"grid gap-1 py-1",children:[t.jsx(o,{htmlFor:n,children:e.label}),t.jsx(p,{id:n,value:(d??[]).join(`
`),onChange:s=>a(e.name,s.target.value.split(`
`).filter(Boolean))}),t.jsx("p",{className:"text-xs text-muted-foreground",children:"每行一项"})]},n);case"password":return t.jsxs("div",{className:"grid gap-1 py-1",children:[t.jsx(o,{htmlFor:n,children:e.label}),t.jsx(r,{id:n,type:"password",value:d??"",onChange:s=>a(e.name,s.target.value)})]},n);default:return t.jsxs("div",{className:"grid gap-1 py-1",children:[t.jsx(o,{htmlFor:n,children:e.label}),t.jsx(r,{id:n,value:d??"",onChange:s=>a(e.name,s.target.value)})]},n)}};return t.jsx("div",{children:u.map(e=>"group"in e?t.jsxs("fieldset",{className:"mb-4",children:[t.jsx("legend",{className:"font-semibold",children:e.group}),e.fields.map(l)]},e.group):l(e))})}const v=`
    query GetTenantSettings($channelId: ID!) {
        tenantSettings(channelId: $channelId) {
            channelId
            basic
            auth
            pay
            map
            serviceNotify
            multiLanguage
            canEdit
        }
    }
`,T=`
    mutation UpdateTenantBasic($input: TenantSectionPatchInput!) {
        updateTenantBasic(input: $input) {
            channelId
            basic
        }
    }
`,b=`
    mutation UpdateTenantMultiLanguage($input: TenantSectionPatchInput!) {
        updateTenantMultiLanguage(input: $input) {
            channelId
            multiLanguage
        }
    }
`,I=`
    mutation UpdateTenantServiceNotify($input: TenantSectionPatchInput!) {
        updateTenantServiceNotify(input: $input) {
            channelId
            serviceNotify
        }
    }
`,N=`
    mutation UpdateTenantConfig($input: UpdateTenantConfigInput!) {
        updateTenantConfig(input: $input) {
            channelId
            auth
            pay
            map
            canEdit
        }
    }
`;export{j as S,b as a,N as b,I as c,h as d,v as t,T as u};
