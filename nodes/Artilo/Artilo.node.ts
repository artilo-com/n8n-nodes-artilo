import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ResourceMapperFields,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { CREDENTIAL_NAME } from '../shared/constants';
import { type ArtiloLeadField, toMappingFields } from '../shared/lead-fields';
import { buildLeadWriteBody, EMPTY_REQUEST_ID_MESSAGE } from '../shared/lead-write';
import { artiloRequest } from '../shared/transport';
import { leadFields, leadOperations } from './LeadDescription';

const SEVERAL_MATCHES_MESSAGE = 'More than one lead has this email. Search by Artilo ID instead.';

/** Errors from the helpers already carry their message and item; others are wrapped. */
const asNodeError = (
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
): NodeApiError | NodeOperationError =>
	error instanceof NodeApiError || error instanceof NodeOperationError
		? error
		: new NodeOperationError(context.getNode(), error as Error, { itemIndex });

async function loadLeadFields(
	this: ILoadOptionsFunctions,
	action: 'create' | 'update',
): Promise<ResourceMapperFields> {
	const response = await artiloRequest.call(this, {
		method: 'GET',
		path: '/leads/fields',
		qs: { action },
	});
	const fields = Array.isArray(response.body) ? (response.body as ArtiloLeadField[]) : [];
	return { fields: toMappingFields(fields) };
}

async function findLead(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject[]> {
	const searchBy = this.getNodeParameter('searchBy', itemIndex) as string;
	const value = String(this.getNodeParameter('value', itemIndex, '')).trim();
	if (!value) {
		throw new NodeOperationError(
			this.getNode(),
			'Value is empty. Map the Artilo ID or email to search for from an earlier step.',
			{ itemIndex },
		);
	}
	const response = await artiloRequest.call(this, {
		method: 'GET',
		path: '/leads/search',
		qs: { [searchBy]: value },
		itemIndex,
	});
	const leads = Array.isArray(response.body) ? (response.body as IDataObject[]) : [];
	if (leads.length > 1) {
		throw new NodeOperationError(this.getNode(), SEVERAL_MATCHES_MESSAGE, { itemIndex });
	}
	return leads;
}

function leadPath(this: IExecuteFunctions, itemIndex: number): string {
	const leadId = String(this.getNodeParameter('leadId', itemIndex, '')).trim();
	if (!leadId) {
		throw new NodeOperationError(
			this.getNode(),
			'Lead ID is empty. Map the Artilo ID of the lead, for example from a Find Lead step, and check it was found before this step.',
			{ itemIndex },
		);
	}
	return `/leads/${encodeURIComponent(leadId)}`;
}

async function writeLead(
	this: IExecuteFunctions,
	itemIndex: number,
	operation: 'create' | 'update',
): Promise<IDataObject> {
	const body = buildLeadWriteBody(
		String(this.getNodeParameter('requestId', itemIndex, '')),
		// Unvalidated: n8n would refuse a blank number or date, or turn it into 0,
		// before the blanks could be dropped. Artilo checks every value itself.
		this.getNodeParameter('fields.value', itemIndex, {}, { skipValidation: true }) as IDataObject,
	);
	if (!body) {
		throw new NodeOperationError(this.getNode(), EMPTY_REQUEST_ID_MESSAGE, { itemIndex });
	}
	const path = operation === 'create' ? '/leads' : leadPath.call(this, itemIndex);
	const response = await artiloRequest.call(this, {
		method: operation === 'create' ? 'POST' : 'PATCH',
		path,
		body: { requestId: body.requestId, values: body.values as IDataObject },
		itemIndex,
	});
	return response.body as IDataObject;
}

export class Artilo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Artilo',
		name: 'artilo',
		icon: { light: 'file:artilo.svg', dark: 'file:artilo.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Find, create and update leads in Artilo',
		defaults: { name: 'Artilo' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: CREDENTIAL_NAME, required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Lead', value: 'lead' }],
				default: 'lead',
			},
			...leadOperations,
			...leadFields,
		],
	};

	methods = {
		resourceMapping: {
			async getCreateFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				return loadLeadFields.call(this, 'create');
			},
			async getUpdateFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				return loadLeadFields.call(this, 'update');
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const results =
					operation === 'find'
						? await findLead.call(this, itemIndex)
						: [await writeLead.call(this, itemIndex, operation as 'create' | 'update')];
				for (const result of results) {
					returnData.push({ json: result, pairedItem: { item: itemIndex } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				const nodeError = asNodeError(this, error, itemIndex);
				throw nodeError;
			}
		}

		return [returnData];
	}
}
