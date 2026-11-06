'use client';
import {useEffect,useState} from 'react';
import {normalizeCrmTheme,type CrmTheme} from '@/lib/crm-navigation';
export function useCrmTheme(){
 const [theme,setTheme]=useState<CrmTheme>('mixed');
 useEffect(()=>{
  try{setTheme(normalizeCrmTheme(localStorage.getItem('crm.ui.theme.v1')));}catch{}
  const changed=(event:StorageEvent)=>{if(event.key==='crm.ui.theme.v1'||event.key===null)setTheme(normalizeCrmTheme(event.newValue));};
  window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
 },[]);
 function chooseTheme(next:CrmTheme){setTheme(next);try{localStorage.setItem('crm.ui.theme.v1',next);}catch{}}
 return [theme,chooseTheme] as const;
}
