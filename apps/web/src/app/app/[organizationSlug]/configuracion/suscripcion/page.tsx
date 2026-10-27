import {SubscriptionCard} from '@/features/administration/module-settings';
export default async function Page({params}:{params:Promise<{organizationSlug:string}>}){return <SubscriptionCard slug={(await params).organizationSlug}/>;}
