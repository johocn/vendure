import{c as P,br as j,cf as M,u as A,bl as L,t as p,cg as v,bm as x,j as e,T as a,r as b,aR as T,ch as J,ci as w,cj as B,bU as q,b5 as N,b6 as I,ck as F,cl as G,B as f,b7 as y,bb as R,c8 as Q,cm as _}from"./index-DY5P-GzJ.js";import{L as $}from"./list-page-Dhtp2zdk.js";import{D as O}from"./data-table-bulk-action-item-zvzO_dEv.js";import{B as h,C as V,R as z}from"./rotate-ccw-B1zgxvkq.js";import{P as C}from"./payload-dialog-YjoPkaTc.js";const U=[["path",{d:"M12 2v4",key:"3427ic"}],["path",{d:"m16.2 7.8 2.9-2.9",key:"r700ao"}],["path",{d:"M18 12h4",key:"wj9ykh"}],["path",{d:"m16.2 16.2 2.9 2.9",key:"1bxg5t"}],["path",{d:"M12 18v4",key:"jadmvz"}],["path",{d:"m4.9 19.1 2.9-2.9",key:"bwix9q"}],["path",{d:"M2 12h4",key:"j09sii"}],["path",{d:"m4.9 4.9 2.9 2.9",key:"giyufr"}]],Z=P("Loader",U),k=j(`
    fragment JobInfo on Job {
        id
        queueName
        createdAt
        startedAt
        settledAt
        state
        isSettled
        progress
        duration
        data
        result
        error
        retries
        attempts
    }
`),H=j(`
        query JobList($options: JobListOptions) {
            jobs(options: $options) {
                items {
                    ...JobInfo
                }
                totalItems
            }
        }
    `,[k]),Y=j(`
    query JobQueueList {
        jobQueues {
            name
            running
        }
    }
`),S=j(`
        mutation CancelJob($jobId: ID!) {
            cancelJob(jobId: $jobId) {
                ...JobInfo
            }
        }
    `,[k]),K=({selection:r,table:c})=>{const{refetchPaginatedList:u}=M(),{_:n}=A(),d=r.filter(s=>s.state==="RUNNING"||s.state==="PENDING"),i=d.length,{mutate:g,isPending:t}=L({mutationFn:async()=>{const s=await Promise.allSettled(d.map(o=>x.mutate(S,{jobId:o.id}))),l=s.filter(o=>o.status==="fulfilled").length,m=s.filter(o=>o.status==="rejected").length;return{fulfilled:l,rejected:m}},onSuccess:({fulfilled:s,rejected:l})=>{s>0&&p.success(v._({id:"3BNwPT",values:{0:n({id:"0PZvtM",values:{fulfilled:s}}),1:n({id:"jyQIxx",values:{fulfilled:s}}),fulfilled:s}})),l>0&&p.error(v._({id:"mtjTGZ",values:{0:n({id:"Vm7mSV",values:{rejected:l}}),1:n({id:"swG/kW",values:{rejected:l}}),rejected:l}})),u(),c.resetRowSelection()}});return i===0?null:e.jsx(O,{requiresPermission:["DeleteSettings","DeleteSystem"],onClick:()=>g(),disabled:t,label:e.jsx(a,{id:"BQ46c7",values:{cancellableCount:i}}),confirmationText:e.jsx(a,{id:"wTQAyT",values:{cancellableCount:i}}),icon:h,className:"text-destructive"})};function X(r){if(r<1e3)return`${r}ms`;const c=Math.floor(r/1e3),u=Math.floor(c/60),n=Math.floor(u/60),d=Math.floor(n/24),i=[];return d>0&&i.push(`${d}d`),n%24>0&&i.push(`${n%24}h`),u%60>0&&i.push(`${u%60}m`),c%60>0&&i.push(`${c%60}s`),i.join(" ")}function W(r){switch(r){case"PENDING":case"RETRYING":return"warning";case"COMPLETED":return"success";case"FAILED":case"CANCELLED":return"destructive";default:return"secondary"}}const D=[{label:"Pending",value:"PENDING",icon:J},{label:"Completed",value:"COMPLETED",icon:w},{label:"Running",value:"RUNNING",icon:Z},{label:"Failed",value:"FAILED",icon:V},{label:"Retrying",value:"RETRYING",icon:z},{label:"Cancelled",value:"CANCELLED",icon:h}],E=[{label:e.jsx(a,{id:"az8lvo"}),value:0},{label:e.jsx(a,{id:"a5xvsE"}),value:5e3},{label:e.jsx(a,{id:"UFvKgT"}),value:1e4},{label:e.jsx(a,{id:"hYZ3aH"}),value:3e4},{label:e.jsx(a,{id:"rjE0f3"}),value:6e4}];function ie(){const r=b.useRef(()=>{}),{_:c}=A(),{formatRelativeDate:u}=T(),[n,d]=b.useState(1e4),i=b.useRef(!1);b.useEffect(()=>{if(n===0)return;const t=setInterval(()=>{i.current||r.current()},n);return()=>clearInterval(t)},[n]);const g=E.find(t=>t.value===n);return e.jsx($,{pageId:"job-queue-list",title:e.jsx(a,{id:"AsRAnH"}),defaultSort:[{id:"createdAt",desc:!0}],listQuery:H,route:B,customizeColumns:{createdAt:{cell:({row:t})=>e.jsx("div",{title:t.original.createdAt,children:u(t.original.createdAt)})},data:{cell:({row:t})=>e.jsx(C,{payload:t.original.data,title:e.jsx(a,{id:"XBRZ0Q"}),onOpenChange:s=>i.current=s,description:e.jsx(a,{id:"6V+g40"}),trigger:e.jsx(f,{size:"sm",variant:"secondary",children:e.jsx(a,{id:"gqSqrj"})})})},queueName:{cell:({row:t})=>e.jsx("span",{className:"font-mono",children:t.original.queueName})},result:{cell:({row:t})=>t.original.result?e.jsx(C,{payload:t.original.result,title:e.jsx(a,{id:"bDEHSp"}),onOpenChange:s=>i.current=s,description:e.jsx(a,{id:"swNxZp"}),trigger:e.jsx(f,{size:"sm",variant:"secondary",children:e.jsx(a,{id:"xwytAA"})})}):e.jsx("div",{className:"text-muted-foreground",children:e.jsx(a,{id:"YTKVwL"})})},state:{cell:({row:t,table:s})=>{const l=L({mutationFn:o=>x.mutate(S,{jobId:o}),onSuccess:()=>{r.current()}}),m=D.find(o=>o.value===t.original.state);return e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs(Q,{variant:W(t.original.state),children:[m&&e.jsx(m.icon,{className:t.original.state==="RUNNING"?"animate-spin":void 0}),t.original.state]}),t.original.state==="RUNNING"&&e.jsxs(N,{onOpenChange:o=>i.current=o,children:[e.jsx(I,{render:e.jsx(f,{variant:"ghost",size:"icon-xs"}),children:e.jsx(_,{})}),e.jsx(y,{align:"end",children:e.jsxs(R,{onClick:()=>l.mutate(t.original.id),disabled:l.isPending,className:"text-destructive focus:text-destructive",children:[e.jsx(h,{}),e.jsx(a,{id:"FnSb+y"})]})})]})]})}},duration:{cell:({row:t})=>t.original.duration?X(t.original.duration):null}},defaultVisibility:{isSettled:!1,settledAt:!1,progress:!1,retries:!1,attempts:!1,error:!1,startedAt:!1},facetedFilters:{queueName:{title:c({id:"b24kPi"}),optionsFn:async()=>x.query(Y).then(t=>t.jobQueues.map(s=>({label:s.name,value:s.name})))},state:{title:c({id:"RS0o7b"}),options:D}},bulkActions:[{component:K,order:100}],registerRefresher:t=>{r.current=t},children:e.jsx(q,{itemId:"auto-refresh-button",children:e.jsxs(N,{children:[e.jsxs(I,{render:e.jsx(f,{variant:"outline",size:"sm",className:"gap-2"}),children:[e.jsx(F,{className:"h-4 w-4"}),e.jsx("span",{children:e.jsx(a,{id:"0OgmBr",values:{0:g?.label}})}),e.jsx(G,{className:"h-4 w-4"})]}),e.jsx(y,{align:"end",children:E.map(t=>e.jsx(R,{onClick:()=>d(t.value),className:n===t.value?"bg-accent":"",children:t.label},t.value))})]})})})}export{ie as component};
