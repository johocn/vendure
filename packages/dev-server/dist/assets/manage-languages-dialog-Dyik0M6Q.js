import{bQ as P,bk as T,o as I,r as m,u as Z,p as O,t as h,a as L,j as e,bC as _,bq as z,br as B,bs as V,T as s,bt as X,c0 as F,c1 as y,bu as N,c2 as Y,aa as H,bS as W,bv as ee,bw as ae,bx as se,by as te,bz as ne,bA as le,B as R,g as G}from"./index-BRWcz4T7.js";import{u as ie,L as w}from"./language-selector-DYXGp-WE.js";const de=G(`
    query GlobalSettingsLanguages {
        globalSettings {
            id
            availableLanguages
        }
    }
`),re=G(`
    mutation UpdateGlobalSettingsLanguages($input: UpdateGlobalSettingsInput!) {
        updateGlobalSettings(input: $input) {
            __typename
            ... on GlobalSettings {
                id
                availableLanguages
            }
            ... on ErrorResult {
                errorCode
                message
            }
        }
    }
`),oe=G(`
    mutation UpdateChannelLanguages($input: UpdateChannelInput!) {
        updateChannel(input: $input) {
            __typename
            ... on Channel {
                id
                code
                defaultLanguageCode
                availableLanguageCodes
            }
            ... on ErrorResult {
                errorCode
                message
            }
        }
    }
`);function me({open:u,onClose:p}){const{activeChannel:J}=P(),{hasPermissions:i}=T(),g=I(),n=J,b=i(["ReadSettings"])||i(["ReadGlobalSettings"]),j=i(["UpdateSettings"])||i(["UpdateGlobalSettings"]),D=i(["ReadChannel"]),c=i(["UpdateChannel"]),[d,U]=m.useState([]),[r,f]=m.useState([]),[o,x]=m.useState(""),C=ie(r||[]),{data:l,isLoading:$,error:Q}=Z({queryKey:["globalSettings","languages"],queryFn:()=>L.query(de),enabled:u&&b}),E=O({mutationFn:a=>L.mutate(re,{input:a}),onSuccess:()=>{g.invalidateQueries({queryKey:["globalSettings"]}),g.invalidateQueries({queryKey:["getServerConfig"]}),h.success("Global language settings updated successfully")},onError:a=>{h.error(`Failed to update global settings: ${a.message}`)}}),q=O({mutationFn:a=>L.mutate(oe,{input:a}),onSuccess:()=>{g.invalidateQueries({queryKey:["channels"]}),g.invalidateQueries({queryKey:["activeChannel"]}),h.success("Channel language settings updated successfully")},onError:a=>{h.error(`Failed to update channel settings: ${a.message}`)}});m.useEffect(()=>{u&&l&&U(l.globalSettings.availableLanguages||[]),u&&n&&(f(n.availableLanguageCodes||[]),x(n.defaultLanguageCode||""))},[u,l,n]);const k=a=>{U(a);const t=r.filter(S=>a.includes(S));f(t),a.includes(o)||x(t[0]||"")},A=a=>{f(a),a.includes(o)||x(a[0]||"")},K=async()=>{const a=[];if(j&&l){const t=l.globalSettings.availableLanguages||[];JSON.stringify(t.sort())!==JSON.stringify(d.sort())&&a.push(E.mutateAsync({availableLanguages:d}))}if(c&&n){const t=n.availableLanguageCodes||[],S=n.defaultLanguageCode||"";(JSON.stringify(t.sort())!==JSON.stringify(r.sort())||S!==o)&&a.push(q.mutateAsync({id:n.id,availableLanguageCodes:r,defaultLanguageCode:o}))}try{await Promise.all(a),p()}catch{}},M=()=>{if(l&&j){const a=l.globalSettings.availableLanguages||[];if(JSON.stringify(a.sort())!==JSON.stringify(d.sort()))return!0}if(n&&c){const a=n.availableLanguageCodes||[],t=n.defaultLanguageCode||"";return JSON.stringify(a.sort())!==JSON.stringify(r.sort())||t!==o}return!1},v=E.isPending||q.isPending;return e.jsx(_,{open:u,onOpenChange:p,children:e.jsxs(z,{className:"max-w-2xl max-h-[80vh] overflow-y-auto",children:[e.jsxs(B,{children:[e.jsx(V,{children:e.jsx(s,{id:"+KsEPl"})}),e.jsx(X,{children:e.jsx(s,{id:"TUn15d"})})]}),e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-3",children:[e.jsx("h3",{className:"font-semibold",children:e.jsx(s,{id:"wCiE/8"})}),!b&&e.jsx(F,{className:"h-4 w-4 text-muted-foreground"})]}),b?$?e.jsx("div",{className:"text-sm text-muted-foreground",children:e.jsx(s,{id:"cZfFVY"})}):Q?e.jsxs("div",{className:"flex items-center gap-2 p-3 bg-destructive/10 rounded-md",children:[e.jsx(y,{className:"h-4 w-4 text-destructive"}),e.jsx("span",{className:"text-sm text-destructive",children:e.jsx(s,{id:"tdu1lo"})})]}):e.jsxs("div",{className:"space-y-2",children:[e.jsx(N,{children:e.jsx(s,{id:"lZ1k+X"})}),e.jsx("div",{className:j?"":"pointer-events-none opacity-50",children:e.jsx(w,{value:d,onChange:k,multiple:!0,availableLanguageCodes:Y})}),e.jsx("p",{className:"text-xs text-muted-foreground",children:e.jsx(s,{id:"zYRRLp"})})]}):e.jsxs("div",{className:"flex items-center gap-2 p-3 bg-muted rounded-md",children:[e.jsx(y,{className:"h-4 w-4 text-muted-foreground"}),e.jsx("span",{className:"text-sm text-muted-foreground",children:e.jsx(s,{id:"yJyG7D"})})]})]}),e.jsx(H,{}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-3",children:[e.jsxs("h3",{className:"font-semibold",children:[e.jsx(s,{id:"bZmZc2"})," -"," ",e.jsx(W,{code:n?.code})]}),!D&&e.jsx(F,{className:"h-4 w-4 text-muted-foreground"})]}),D?e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"space-y-2",children:[e.jsx(N,{className:"text-sm font-medium",children:e.jsx(s,{id:"pLwWyo"})}),e.jsx("div",{className:c?"":"pointer-events-none opacity-50",children:e.jsx(w,{value:r,onChange:A,multiple:!0,availableLanguageCodes:d})}),d.length===0?e.jsx("p",{className:"text-xs text-muted-foreground",children:e.jsx(s,{id:"j2a7dU"})}):e.jsx("p",{className:"text-xs text-muted-foreground",children:e.jsx(s,{id:"F+Cfi2"})})]}),C.length>0&&e.jsxs("div",{children:[e.jsx(N,{className:"text-sm font-medium mb-2 block",children:e.jsx(s,{id:"TOFdm+"})}),e.jsxs(ee,{items:Object.fromEntries(C.map(({code:a,label:t})=>[a,`${t} (${a.toUpperCase()})`])),value:o,onValueChange:a=>{a!=null&&x(a)},disabled:!c,children:[e.jsx(ae,{className:"w-[200px]",children:e.jsx(se,{placeholder:"Select default language"})}),e.jsx(te,{children:C.map(({code:a,label:t})=>e.jsxs(ne,{value:a,children:[t," (",a.toUpperCase(),")"]},a))})]})]})]}):e.jsxs("div",{className:"flex items-center gap-2 p-3 bg-muted rounded-md",children:[e.jsx(y,{className:"h-4 w-4 text-muted-foreground"}),e.jsx("span",{className:"text-sm text-muted-foreground",children:e.jsx(s,{id:"eB+0qz"})})]})]})]}),e.jsxs(le,{children:[e.jsx(R,{variant:"outline",onClick:p,disabled:v,children:e.jsx(s,{id:"dEgA5A"})}),e.jsx(R,{onClick:K,disabled:!M()||v,children:v?e.jsx(s,{id:"XvjC4F"}):e.jsx(s,{id:"IUwGEM"})})]})]})})}export{me as M};
