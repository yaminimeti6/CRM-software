// Hide local development hosts in the compact table only; saved values remain intact.
export function isLocalSource(value:string):boolean {
 try{
  const host=new URL(value.includes('://')?value:'http://'+value).hostname.toLowerCase().replace(/^\[|\]$/g,'');
  return host==='localhost'||host.endsWith('.localhost')||host==='127.0.0.1'||host==='::1';
 }catch{return false;}
}
