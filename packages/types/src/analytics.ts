export interface AnalyticsRange {from:string;to:string;previousFrom:string;previousTo:string;timeZone:string;days:number;}
export interface Metric {value:string;previous:string|null;change:string|null;scope:'period'|'current';}
export interface DashboardSummary {range:AnalyticsRange;updatedAt:string;metrics:Record<'sales'|'payments'|'balance'|'customers'|'pendingQuotes'|'approvedQuotes'|'openOperations'|'completedOperations',Metric>;partialPayments:number;pendingCollections:number;}
export interface AnalyticsSeries {range:AnalyticsRange;data:{date:string;amount:string}[];}
export interface StatusSeries {range:AnalyticsRange;data:{status:string;count:number}[];}
export interface ReportRow {id:string;number:string;customerName:string;date:string;status:string;total:string;type?:string;paidTotal?:string;balance?:string;reference?:string|null;}
export interface Activity {id:string;action:string;createdAt:string;actorName:string;number?:string;}
export interface OrganizationMember {id:string;role:'OWNER'|'ADMIN'|'MEMBER';deactivatedAt:string|null;createdAt:string;user:{id:string;name:string;email:string};}
export interface Invitation {id:string;email:string;role:'OWNER'|'ADMIN'|'MEMBER';kind:'MEMBER'|'OWNERSHIP';expiresAt:string;revokedAt:string|null;acceptedAt:string|null;deliveredAt:string|null;createdAt:string;}
export interface ModulesConfiguration {businessType:'PRODUCTS'|'SERVICES'|'MIXED';hiddenModules:string[];available:string[];plan:'EMPRENDE'|'NEGOCIO'|'EQUIPO';}
export interface SubscriptionInfo {plan:'EMPRENDE'|'NEGOCIO'|'EQUIPO';status:string;renewalAt:string|null;limits:{name:string;users:number;modules:readonly string[]};used:number;reserved:number;billingEnabled:false;plans:Record<'EMPRENDE'|'NEGOCIO'|'EQUIPO',{name:string;users:number;modules:readonly string[]}>;}
