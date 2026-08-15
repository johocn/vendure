import{aY as c,ay as n,az as b,b7 as m,j as L,e1 as p,L as d,aA as f}from"./index-CfivDxyc.js";function v(e){const{formatLanguageName:l}=c();return n.useMemo(()=>(e??[]).map(a=>({code:a,label:l(a)})).sort((a,s)=>a.label.localeCompare(s.label)),[e,l])}const y=d(`
    query AvailableGlobalLanguages {
        globalSettings {
            availableLanguages
        }
    }
`);function S(e){const{data:l}=b({queryKey:["availableGlobalLanguages"],queryFn:()=>f.query(y),staleTime:3e5}),{value:a,onChange:s,multiple:r,availableLanguageCodes:g}=e,{_:o}=m(),t=v(g??l?.globalSettings.availableLanguages??void 0),i=n.useMemo(()=>t.map(u=>({value:u.code,label:u.label})),[t]);return L.jsx(p,{value:a,onChange:s,multiple:r,items:i,placeholder:o({id:"ffxVQ8"}),searchPlaceholder:o({id:"StoBff"})})}export{S as L,v as u};
