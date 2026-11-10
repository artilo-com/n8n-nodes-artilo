/** The Artilo records the action node finds, creates and updates. */
export type ArtiloResource = 'lead' | 'client' | 'company' | 'deal';

export interface ResourceConfig {
	/** The route segment of the integration API: `/leads`, `/clients`, ... */
	path: string;
	noun: string;
	/** The node parameter holding the Artilo ID of the record to update. */
	idParameter: string;
}

export const RESOURCES: Record<ArtiloResource, ResourceConfig> = {
	lead: { path: 'leads', noun: 'Lead', idParameter: 'leadId' },
	client: { path: 'clients', noun: 'Client', idParameter: 'clientId' },
	company: { path: 'companies', noun: 'Company', idParameter: 'companyId' },
	deal: { path: 'deals', noun: 'Deal', idParameter: 'dealId' },
};

export const isArtiloResource = (value: string): value is ArtiloResource =>
	Object.prototype.hasOwnProperty.call(RESOURCES, value);
