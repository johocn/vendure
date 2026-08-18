import{br as v,e2 as S,r as h,bk as q,bE as F,j as e,b4 as P,aT as T,aU as B,aV as R,T as l,aW as M,b1 as V,B as C,bm as $,cf as O,u as U,bl as Y,e3 as _,t as b}from"./index-DY5P-GzJ.js";import{D as G}from"./data-table-bulk-action-item-zvzO_dEv.js";import{g as H,C as K}from"./configurable-operation-utils-BG7Oy4cK.js";const N=v(`
    mutation DuplicateEntity($input: DuplicateEntityInput!) {
        duplicateEntity(input: $input) {
            ... on DuplicateEntitySuccess {
                newEntityId
            }
            ... on ErrorResult {
                errorCode
                message
            }
            ... on DuplicateEntityError {
                duplicationError
            }
        }
    }
`),Q=v(`
        query GetEntityDuplicators {
            entityDuplicators {
                code
                description
                requiresPermission
                forEntities
                args {
                    ...ConfigArgDefinition
                }
            }
        }
    `,[S]);function W({open:g,onOpenChange:d,entityType:y,entityName:i,duplicatorCode:m,onConfirm:r}){const[a,c]=h.useState(),{data:E}=q({queryKey:["entityDuplicators"],queryFn:()=>$.query(Q),staleTime:1e3*60*60*5}),s=E?.entityDuplicators?.find(n=>n.code===m&&n.forEntities.includes(y));F.useEffect(()=>{s&&!a&&c({code:s.code,arguments:s.args?.map(n=>({name:n.name,value:H(n)}))||[]})},[s,a]);const D=n=>{c(n)},x=()=>{a&&(r(a),d(!1),c(void 0))},p=()=>{d(!1),c(void 0)};return e.jsx(P,{open:g,onOpenChange:d,children:e.jsxs(T,{className:"sm:max-w-lg",children:[e.jsxs(B,{children:[e.jsx(R,{children:e.jsx(l,{id:"Lns7sP",values:{0:i.toLowerCase()}})}),e.jsx(M,{className:"sr-only",children:e.jsx(l,{id:"bX+LyM",values:{0:i.toLowerCase()}})})]}),e.jsxs("div",{className:"space-y-4",children:[a&&s&&e.jsx(K,{operationDefinition:s,value:a,onChange:D,removable:!1}),!s&&e.jsx("div",{className:"text-sm text-muted-foreground",children:e.jsx(l,{id:"B6LoY7",values:{duplicatorCode:m,entityName:i}})})]}),e.jsxs(V,{children:[e.jsx(C,{variant:"outline",onClick:p,children:e.jsx(l,{id:"dEgA5A"})}),e.jsx(C,{onClick:x,disabled:!a,children:e.jsx(l,{id:"euc6Ns"})})]})]})})}function Z({entityType:g,duplicatorCode:d,requiredPermissions:y,entityName:i,onSuccess:m,selection:r,table:a}){const{refetchPaginatedList:c}=O(),{_:E}=U(),[s,D]=h.useState(!1),[x,p]=h.useState({completed:0,total:0}),[n,j]=h.useState(!1),{mutateAsync:w}=Y({mutationFn:$.mutate(N)}),L=()=>{s||j(!0)},k=async A=>{if(s)return;D(!0),p({completed:0,total:r.length});const t={success:0,failed:0,errors:[]};try{for(let o=0;o<r.length;o++){const f=r[o];try{const u=await w({input:{entityName:g,entityId:f.id,duplicatorInput:A}});if("newEntityId"in u.duplicateEntity)t.success++;else{t.failed++;const I=u.duplicateEntity.message||u.duplicateEntity.duplicationError||"Unknown error";t.errors.push(`${i} ${f.name||f.id}: ${I}`)}}catch(u){t.failed++,t.errors.push(`${i} ${f.name||f.id}: ${u instanceof Error?u.message:"Unknown error"}`)}p({completed:o+1,total:r.length})}if(t.success>0){const o=t.success;b.success(E({id:"YRTdLc",values:{count:o,entityName:i}}))}if(t.failed>0){const o=t.errors.length>3?`${t.errors.slice(0,3).join(", ")}... and ${t.errors.length-3} more`:t.errors.join(", ");b.error(`Failed to duplicate ${t.failed} ${i.toLowerCase()}s: ${o}`)}t.success>0&&(c(),a.resetRowSelection(),m?.())}finally{D(!1),p({completed:0,total:0})}};return e.jsxs(e.Fragment,{children:[e.jsx(G,{requiresPermission:y,onClick:L,label:s?e.jsx(l,{id:"+lpe0V",values:{0:x.completed,1:x.total}}):e.jsx(l,{id:"euc6Ns"}),icon:_,closeOnClick:!1}),e.jsx(W,{open:n,onOpenChange:j,entityType:g,entityName:i,entities:r,duplicatorCode:d,onConfirm:k})]})}export{Z as D};
