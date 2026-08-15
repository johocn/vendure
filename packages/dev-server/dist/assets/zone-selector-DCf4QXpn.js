import{u as l,j as s,dA as c,bw as d,bx as m,by as u,T as p,bz as x,dB as h,bA as j,g as S,a as g}from"./index-DqgpDxui.js";const y=S(`
    query Zones($options: ZoneListOptions) {
        zones(options: $options) {
            items {
                id
                name
            }
        }
    }
`);function f({value:t,onChange:i}){const{data:n,isLoading:a,isPending:o}=l({queryKey:["zones"],staleTime:3e5,queryFn:()=>g.query(y,{options:{take:100}})});return a||o?s.jsx(c,{className:"h-10 w-full"}):s.jsxs(d,{items:n?Object.fromEntries(n.zones.items.map(e=>[e.id,e.name])):{},value:t??"",onValueChange:e=>e&&i(e),children:[s.jsx(m,{children:s.jsx(u,{placeholder:s.jsx(p,{id:"p3M+0h"}),children:e=>n?.zones.items.find(r=>r.id===e)?.name})}),s.jsx(x,{children:n&&s.jsx(h,{children:n?.zones.items.map(e=>s.jsx(j,{value:e.id,children:e.name},e.id))})})]})}export{f as Z};
