import{bk as l,j as s,fE as c,aY as m,aZ as d,a_ as u,T as p,a$ as h,fF as j,b0 as x,br as f,bm as S}from"./index-DY5P-GzJ.js";const g=f(`
    query Zones($options: ZoneListOptions) {
        zones(options: $options) {
            items {
                id
                name
            }
        }
    }
`);function b({value:a,onChange:t}){const{data:n,isLoading:i,isPending:o}=l({queryKey:["zones"],staleTime:3e5,queryFn:()=>S.query(g,{options:{take:100}})});return i||o?s.jsx(c,{className:"h-10 w-full"}):s.jsxs(m,{items:n?Object.fromEntries(n.zones.items.map(e=>[e.id,e.name])):{},value:a??"",onValueChange:e=>e&&t(e),children:[s.jsx(d,{children:s.jsx(u,{placeholder:s.jsx(p,{id:"p3M+0h"}),children:e=>n?.zones.items.find(r=>r.id===e)?.name})}),s.jsx(h,{children:n&&s.jsx(j,{children:n?.zones.items.map(e=>s.jsx(x,{value:e.id,children:e.name},e.id))})})]})}export{b as Z};
