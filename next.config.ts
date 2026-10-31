import type { NextConfig } from 'next';
const config:NextConfig={distDir:process.env.CRM_NEXT_DIST_DIR??'.next',async headers(){return [
 {source:'/join',headers:[{key:'Referrer-Policy',value:'no-referrer'},{key:'Cache-Control',value:'private, no-store'},{key:'X-Robots-Tag',value:'noindex, nofollow'}]},
 {source:'/api/team/:path*',headers:[{key:'Referrer-Policy',value:'no-referrer'}]},
 ];}};
export default config;
