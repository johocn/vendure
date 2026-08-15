import{bR as Q,J as k,o as B,r as m,u as I,p as O,t as h,a as L,j as e,bD as Z,br as _,bs as z,bt as V,T as s,bu as X,c1 as R,c2 as y,bv as N,c3 as Y,ac as H,bT as W,bw as ee,bx as ae,by as se,bz as te,bA as ne,bB as le,B as F,g as D}from"./index-Db6dV6Bh.js";import{u as ie,L as J}from"./language-selector-ClptxUDN.js";const de=D(`
    query GlobalSettingsLanguages {
        globalSettings {
            id
            availableLanguages
        }
    }
`),re=D(`
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
`),oe=D(`
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
`);function me({open:u,onClose:p}){const{activeChannel:w}=Q(),{hasPermissions:i}=k(),g=B(),n=w,b=i(["ReadSettings"])||i(["ReadGlobalSettings"]),j=i(["UpdateSettings"])||i(["UpdateGlobalSettings"]),G=i(["ReadChannel"]),c=i(["UpdateChannel"]),[d,U]=m.useState([]),[r,f]=m.useState([]),[o,x]=m.useState(""),C=ie(r||[]),{data:l,isLoading:$,error:T}=I({queryKey:["globalSettings","languages"],queryFn:()=>L.query(de),enabled:u&&b}),E=O({mutationFn:a=>L.mutate(re,{input:a}),onSuccess:()=>{g.invalidateQueries({queryKey:["globalSettings"]}),g.invalidateQueries({queryKey:["getServerConfig"]}),h.success("Global language settings updated successfully")},onError:a=>{h.error(`Failed to update global settings: ${a.message}`)}}),q=O({mutationFn:a=>L.mutate(oe,{input:a}),onSuccess:()=>{g.invalidateQueries({queryKey:["channels"]}),g.invalidateQueries({queryKey:["activeChannel"]}),h.success("Channel language settings updated successfully")},onError:a=>{h.error(`Failed to update channel settings: ${a.message}`)}});m.useEffect(()=>{u&&l&&U(l.globalSettings.availableLanguages||[]),u&&n&&(f(n.availableLanguageCodes||[]),x(n.defaultLanguageCode||""))},[u,l,n]);const A=a=>{U(a);const t=r.filter(S=>a.includes(S));f(t),a.includes(o)||x(t[0]||"")},K=a=>{f(a),a.includes(o)||x(a[0]||"")},M=async()=>{const a=[];if(j&&l){const t=l.globalSettings.availableLanguages||[];JSON.stringify(t.sort())!==JSON.stringify(d.sort())&&a.push(E.mutateAsync({availableLanguages:d}))}if(c&&n){const t=n.availableLanguageCodes||[],S=n.defaultLanguageCode||"";(JSON.stringify(t.sort())!==JSON.stringify(r.sort())||S!==o)&&a.push(q.mutateAsync({id:n.id,availableLanguageCodes:r,defaultLanguageCode:o}))}try{await Promise.all(a),p()}catch{}},P=()=>{if(l&&j){const a=l.globalSettings.availableLanguages||[];if(JSON.stringify(a.sort())!==JSON.stringify(d.sort()))return!0}if(n&&c){const a=n.availableLanguageCodes||[],t=n.defaultLanguageCode||"";return JSON.stringify(a.sort())!==JSON.stringify(r.sort())||t!==o}return!1},v=E.isPending||q.isPending;return e.jsx(Z,{open:u,onOpenChange:p,children:e.jsxs(_,{className:"max-w-2xl max-h-[80vh] overflow-y-auto",children:[e.jsxs(z,{children:[e.jsx(V,{children:e.jsx(s,{id:"+KsEPl"})}),e.jsx(X,{children:e.jsx(s,{id:"TUn15d"})})]}),e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-3",children:[e.jsx("h3",{className:"font-semibold",children:e.jsx(s,{id:"wCiE/8"})}),!b&&e.jsx(R,{className:"h-4 w-4 text-muted-foreground"})]}),b?$?e.jsx("div",{className:"text-sm text-muted-foreground",children:e.jsx(s,{id:"cZfFVY"})}):T?e.jsxs("div",{className:"flex items-center gap-2 p-3 bg-destructive/10 rounded-md",children:[e.jsx(y,{className:"h-4 w-4 text-destructive"}),e.jsx("span",{className:"text-sm text-destructive",children:e.jsx(s,{id:"tdu1lo"})})]}):e.jsxs("div",{className:"space-y-2",children:[e.jsx(N,{children:e.jsx(s,{id:"lZ1k+X"})}),e.jsx("div",{className:j?"":"pointer-events-none opacity-50",children:e.jsx(J,{value:d,onChange:A,multiple:!0,availableLanguageCodes:Y})}),e.jsx("p",{className:"text-xs text-muted-foreground",children:e.jsx(s,{id:"zYRRLp"})})]}):e.jsxs("div",{className:"flex items-center gap-2 p-3 bg-muted rounded-md",children:[e.jsx(y,{className:"h-4 w-4 text-muted-foreground"}),e.jsx("span",{className:"text-sm text-muted-foreground",children:e.jsx(s,{id:"yJyG7D"})})]})]}),e.jsx(H,{}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-3",children:[e.jsxs("h3",{className:"font-semibold",children:[e.jsx(s,{id:"bZmZc2"})," -"," ",e.jsx(W,{code:n?.code})]}),!G&&e.jsx(R,{className:"h-4 w-4 text-muted-foreground"})]}),G?e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"space-y-2",children:[e.jsx(N,{className:"text-sm font-medium",children:e.jsx(s,{id:"pLwWyo"})}),e.jsx("div",{className:c?"":"pointer-events-none opacity-50",children:e.jsx(J,{value:r,onChange:K,multiple:!0,availableLanguageCodes:d})}),d.length===0?e.jsx("p",{className:"text-xs text-muted-foreground",children:e.jsx(s,{id:"j2a7dU"})}):e.jsx("p",{className:"text-xs text-muted-foreground",children:e.jsx(s,{id:"F+Cfi2"})})]}),C.length>0&&e.jsxs("div",{children:[e.jsx(N,{className:"text-sm font-medium mb-2 block",children:e.jsx(s,{id:"TOFdm+"})}),e.jsxs(ee,{items:Object.fromEntries(C.map(({code:a,label:t})=>[a,`${t} (${a.toUpperCase()})`])),value:o,onValueChange:a=>{a!=null&&x(a)},disabled:!c,children:[e.jsx(ae,{className:"w-[200px]",children:e.jsx(se,{placeholder:"Select default language"})}),e.jsx(te,{children:C.map(({code:a,label:t})=>e.jsxs(ne,{value:a,children:[t," (",a.toUpperCase(),")"]},a))})]})]})]}):e.jsxs("div",{className:"flex items-center gap-2 p-3 bg-muted rounded-md",children:[e.jsx(y,{className:"h-4 w-4 text-muted-foreground"}),e.jsx("span",{className:"text-sm text-muted-foreground",children:e.jsx(s,{id:"eB+0qz"})})]})]})]}),e.jsxs(le,{children:[e.jsx(F,{variant:"outline",onClick:p,disabled:v,children:e.jsx(s,{id:"dEgA5A"})}),e.jsx(F,{onClick:M,disabled:!P()||v,children:v?e.jsx(s,{id:"XvjC4F"}):e.jsx(s,{id:"IUwGEM"})})]})]})})}export{me as M};
