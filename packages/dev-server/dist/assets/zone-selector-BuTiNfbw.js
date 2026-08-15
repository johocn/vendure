import{az as l,j as s,eh as c,F as m,G as d,H as u,Q as p,I as h,ei as j,J as x,L as S,aA as f}from"./index-B5sUqbxQ.js";const g=S(`
    query Zones($options: ZoneListOptions) {
        zones(options: $options) {
            items {
                id
                name
            }
        }
    }
`);function q({value:i,onChange:t}){const{data:n,isLoading:a,isPending:o}=l({queryKey:["zones"],staleTime:3e5,queryFn:()=>f.query(g,{options:{take:100}})});return a||o?s.jsx(c,{className:"h-10 w-full"}):s.jsxs(m,{items:n?Object.fromEntries(n.zones.items.map(e=>[e.id,e.name])):{},value:i??"",onValueChange:e=>e&&t(e),children:[s.jsx(d,{children:s.jsx(u,{placeholder:s.jsx(p,{id:"p3M+0h"}),children:e=>n?.zones.items.find(r=>r.id===e)?.name})}),s.jsx(h,{children:n&&s.jsx(j,{children:n?.zones.items.map(e=>s.jsx(x,{value:e.id,children:e.name},e.id))})})]})}export{q as Z};
