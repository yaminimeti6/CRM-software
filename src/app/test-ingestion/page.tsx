import {notFound} from 'next/navigation';import {TestForm} from './test-form';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{form_id?:string}>}){if(process.env.CRM_ENABLE_INGESTION_TEST_FORM!=='true'||!process.env.CRM_APP_ORIGIN||!['localhost','127.0.0.1'].includes(new URL(process.env.CRM_APP_ORIGIN).hostname))notFound();const q=await searchParams;return <TestForm formId={typeof q.form_id==='string'?q.form_id:''}/>;}
