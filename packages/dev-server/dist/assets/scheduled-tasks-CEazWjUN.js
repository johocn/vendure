import{c as T,u as S,bk as R,bj as D,bl as o,bm as d,t as h,aR as f,j as e,aJ as A,c8 as t,T as a,B as x,b5 as E,b6 as M,ce as q,b7 as v,bb as m,bR as C,bS as L,bV as P,bW as I,ca as J,br as c,cb as N}from"./index-DY5P-GzJ.js";import{P as Q}from"./payload-dialog-YjoPkaTc.js";const z=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polygon",{points:"10 8 16 12 10 16 10 8",key:"1cimsy"}]],F=T("CirclePlay",z),K=c(`
    query ScheduledTasks {
        scheduledTasks {
            id
            description
            schedule
            scheduleDescription
            lastExecutedAt
            nextExecutionAt
            isRunning
            lastResult
            enabled
        }
    }
`),B=c(`
    mutation UpdateScheduledTask($input: UpdateScheduledTaskInput!) {
        updateScheduledTask(input: $input) {
            id
            enabled
        }
    }
`),O=c(`
    mutation RunScheduledTask($id: String!) {
        runScheduledTask(id: $id) {
            success
        }
    }
`);function W(){const{_:i}=S(),{data:l}=R({queryKey:["scheduledTasks"],queryFn:()=>d.query(K)}),r=D(),{mutate:j}=o({mutationFn:d.mutate(B),onSuccess:s=>{u()}}),u=()=>{r.invalidateQueries({queryKey:["scheduledTasks"]})},{mutate:p}=o({mutationFn:d.mutate(O),onSuccess:s=>{s.runScheduledTask.success?(h.success(i({id:"96xJ48"})),r.invalidateQueries({queryKey:["scheduledTasks"]})):h.error(i({id:"DzhRjJ"}))}}),{formatDate:g,formatRelativeDate:y}=f(),k={year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"numeric",second:"numeric"},n=N(),b=[n.accessor("id",{header:i({id:"S0kLOH"}),cell:({getValue:s})=>e.jsx(A,{value:s(),children:e.jsx("span",{className:"font-mono",children:s()})})}),n.accessor("description",{header:i({id:"Nu4oKW"})}),n.accessor("enabled",{header:i({id:"RxzN1M"}),cell:({row:s})=>s.original.enabled?e.jsx(t,{variant:"success",children:e.jsx(a,{id:"RxzN1M"})}):e.jsx(t,{variant:"secondary",children:e.jsx(a,{id:"E/QGRL"})})}),n.accessor("schedule",{header:i({id:"pIxz4h"})}),n.accessor("scheduleDescription",{header:i({id:"gmB6oO"})}),n.accessor("lastExecutedAt",{header:i({id:"RhpMfE"}),cell:({row:s})=>s.original.lastExecutedAt?e.jsx("div",{title:s.original.lastExecutedAt,children:y(s.original.lastExecutedAt)}):e.jsx(a,{id:"qqeAJM"})}),n.accessor("nextExecutionAt",{header:i({id:"WwKMiy"}),cell:({row:s})=>s.original.nextExecutionAt?g(s.original.nextExecutionAt,k):e.jsx(a,{id:"qqeAJM"})}),n.accessor("isRunning",{header:i({id:"RiQMUh"}),cell:({row:s})=>s.original.isRunning?e.jsx(t,{variant:"success",children:e.jsx(a,{id:"RiQMUh"})}):e.jsx(t,{variant:"secondary",children:e.jsx(a,{id:"LXcUnJ"})})}),n.accessor("lastResult",{header:i({id:"ikhZzI"}),cell:({row:s})=>s.original.lastResult?e.jsx(Q,{payload:s.original.lastResult,title:e.jsx(a,{id:"bDEHSp"}),description:e.jsx(a,{id:"swNxZp"}),trigger:e.jsx(x,{size:"sm",variant:"secondary",children:e.jsx(a,{id:"xwytAA"})})}):e.jsx("div",{className:"text-muted-foreground",children:e.jsx(a,{id:"YTKVwL"})})}),n.display({id:"actions",header:i({id:"7L01XJ"}),cell:({row:s})=>e.jsxs(E,{children:[e.jsx(M,{render:e.jsx(x,{variant:"ghost",size:"icon"}),children:e.jsx(q,{})}),e.jsxs(v,{children:[s.original.enabled&&e.jsxs(m,{onClick:()=>p({id:s.original.id}),children:[e.jsx(F,{className:"w-4 h-4"}),e.jsx(a,{id:"3JjdaA"})]}),e.jsx(m,{onClick:()=>j({input:{id:s.original.id,enabled:!s.original.enabled}}),children:s.original.enabled?e.jsx(a,{id:"cO9+2L"}):e.jsx(a,{id:"PaQ3df"})})]})]})})];return e.jsxs(C,{pageId:"scheduled-tasks-list",children:[e.jsx(L,{children:e.jsx(a,{id:"8OiyFS"})}),e.jsx(P,{children:e.jsx(I,{blockId:"list-table",children:e.jsx(J,{onRefresh:u,columns:b,data:l?.scheduledTasks??[],totalItems:l?.scheduledTasks?.length??0,defaultColumnVisibility:{schedule:!1}})})})]})}export{W as component};
