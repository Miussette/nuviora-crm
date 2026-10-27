import {ModuleSettings} from '@/features/administration/module-settings';
export default async function Page({params}:{params:Promise<{organizationSlug:string}>}){return <ModuleSettings slug={(await params).organizationSlug}/>;}
