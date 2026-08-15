import{cM as K,cq as I,aR as T,ay as m,az as Z,aS as O,ax as h,aA as L,j as e,ak as _,am as z,an as V,ao as Y,Q as s,cw as B,cY as F,cZ as y,cx as N,c_ as H,bg as X,cO as W,F as ee,G as ae,H as se,I as ne,J as te,cy as le,P as R,L as G}from"./index-CfivDxyc.js";import{u as ie,L as J}from"./language-selector-CdfSFhKU.js";const de=G(`
    query GlobalSettingsLanguages {
        globalSettings {
            id
            availableLanguages
        }
    }
`),oe=G(`
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
`),re=G(`
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
`);function me({open:g,onClose:p}){const{activeChannel:w}=K(),{hasPermissions:i}=I(),u=T(),t=w,j=i(["ReadSettings"])||i(["ReadGlobalSettings"]),f=i(["UpdateSettings"])||i(["UpdateGlobalSettings"]),D=i(["ReadChannel"]),c=i(["UpdateChannel"]),[d,U]=m.useState([]),[o,C]=m.useState([]),[r,x]=m.useState(""),b=ie(o||[]),{data:l,isLoading:$,error:M}=Z({queryKey:["globalSettings","languages"],queryFn:()=>L.query(de),enabled:g&&j}),E=O({mutationFn:a=>L.mutate(oe,{input:a}),onSuccess:()=>{u.invalidateQueries({queryKey:["globalSettings"]}),u.invalidateQueries({queryKey:["getServerConfig"]}),h.success("Global language settings updated successfully")},onError:a=>{h.error(`Failed to update global settings: ${a.message}`)}}),q=O({mutationFn:a=>L.mutate(re,{input:a}),onSuccess:()=>{u.invalidateQueries({queryKey:["channels"]}),u.invalidateQueries({queryKey:["activeChannel"]}),h.success("Channel language settings updated successfully")},onError:a=>{h.error(`Failed to update channel settings: ${a.message}`)}});m.useEffect(()=>{g&&l&&U(l.globalSettings.availableLanguages||[]),g&&t&&(C(t.availableLanguageCodes||[]),x(t.defaultLanguageCode||""))},[g,l,t]);const P=a=>{U(a);const n=o.filter(S=>a.includes(S));C(n),a.includes(r)||x(n[0]||"")},Q=a=>{C(a),a.includes(r)||x(a[0]||"")},k=async()=>{const a=[];if(f&&l){const n=l.globalSettings.availableLanguages||[];JSON.stringify(n.sort())!==JSON.stringify(d.sort())&&a.push(E.mutateAsync({availableLanguages:d}))}if(c&&t){const n=t.availableLanguageCodes||[],S=t.defaultLanguageCode||"";(JSON.stringify(n.sort())!==JSON.stringify(o.sort())||S!==r)&&a.push(q.mutateAsync({id:t.id,availableLanguageCodes:o,defaultLanguageCode:r}))}try{await Promise.all(a),p()}catch{}},A=()=>{if(l&&f){const a=l.globalSettings.availableLanguages||[];if(JSON.stringify(a.sort())!==JSON.stringify(d.sort()))return!0}if(t&&c){const a=t.availableLanguageCodes||[],n=t.defaultLanguageCode||"";return JSON.stringify(a.sort())!==JSON.stringify(o.sort())||n!==r}return!1},v=E.isPending||q.isPending;return e.jsx(_,{open:g,onOpenChange:p,children:e.jsxs(z,{className:"max-w-2xl max-h-[80vh] overflow-y-auto",children:[e.jsxs(V,{children:[e.jsx(Y,{children:e.jsx(s,{id:"+KsEPl"})}),e.jsx(B,{children:e.jsx(s,{id:"TUn15d"})})]}),e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-3",children:[e.jsx("h3",{className:"font-semibold",children:e.jsx(s,{id:"wCiE/8"})}),!j&&e.jsx(F,{className:"h-4 w-4 text-muted-foreground"})]}),j?$?e.jsx("div",{className:"text-sm text-muted-foreground",children:e.jsx(s,{id:"cZfFVY"})}):M?e.jsxs("div",{className:"flex items-center gap-2 p-3 bg-destructive/10 rounded-md",children:[e.jsx(y,{className:"h-4 w-4 text-destructive"}),e.jsx("span",{className:"text-sm text-destructive",children:e.jsx(s,{id:"tdu1lo"})})]}):e.jsxs("div",{className:"space-y-2",children:[e.jsx(N,{children:e.jsx(s,{id:"lZ1k+X"})}),e.jsx("div",{className:f?"":"pointer-events-none opacity-50",children:e.jsx(J,{value:d,onChange:P,multiple:!0,availableLanguageCodes:H})}),e.jsx("p",{className:"text-xs text-muted-foreground",children:e.jsx(s,{id:"zYRRLp"})})]}):e.jsxs("div",{className:"flex items-center gap-2 p-3 bg-muted rounded-md",children:[e.jsx(y,{className:"h-4 w-4 text-muted-foreground"}),e.jsx("span",{className:"text-sm text-muted-foreground",children:e.jsx(s,{id:"yJyG7D"})})]})]}),e.jsx(X,{}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-3",children:[e.jsxs("h3",{className:"font-semibold",children:[e.jsx(s,{id:"bZmZc2"})," -"," ",e.jsx(W,{code:t?.code})]}),!D&&e.jsx(F,{className:"h-4 w-4 text-muted-foreground"})]}),D?e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"space-y-2",children:[e.jsx(N,{className:"text-sm font-medium",children:e.jsx(s,{id:"pLwWyo"})}),e.jsx("div",{className:c?"":"pointer-events-none opacity-50",children:e.jsx(J,{value:o,onChange:Q,multiple:!0,availableLanguageCodes:d})}),d.length===0?e.jsx("p",{className:"text-xs text-muted-foreground",children:e.jsx(s,{id:"j2a7dU"})}):e.jsx("p",{className:"text-xs text-muted-foreground",children:e.jsx(s,{id:"F+Cfi2"})})]}),b.length>0&&e.jsxs("div",{children:[e.jsx(N,{className:"text-sm font-medium mb-2 block",children:e.jsx(s,{id:"TOFdm+"})}),e.jsxs(ee,{items:Object.fromEntries(b.map(({code:a,label:n})=>[a,`${n} (${a.toUpperCase()})`])),value:r,onValueChange:a=>{a!=null&&x(a)},disabled:!c,children:[e.jsx(ae,{className:"w-[200px]",children:e.jsx(se,{placeholder:"Select default language"})}),e.jsx(ne,{children:b.map(({code:a,label:n})=>e.jsxs(te,{value:a,children:[n," (",a.toUpperCase(),")"]},a))})]})]})]}):e.jsxs("div",{className:"flex items-center gap-2 p-3 bg-muted rounded-md",children:[e.jsx(y,{className:"h-4 w-4 text-muted-foreground"}),e.jsx("span",{className:"text-sm text-muted-foreground",children:e.jsx(s,{id:"eB+0qz"})})]})]})]}),e.jsxs(le,{children:[e.jsx(R,{variant:"outline",onClick:p,disabled:v,children:e.jsx(s,{id:"dEgA5A"})}),e.jsx(R,{onClick:k,disabled:!A()||v,children:v?e.jsx(s,{id:"XvjC4F"}):e.jsx(s,{id:"IUwGEM"})})]})]})})}export{me as M};
