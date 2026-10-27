import {Reports} from '@/features/analytics/reports';
export default async function Page({params}:{params:Promise<{organizationSlug:string}>}){return <Reports slug={(await params).organizationSlug}/>;}
