import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
	ResourceMapperFields,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { CREDENTIAL_NAME } from '../shared/constants';
import { withDecimalTotal } from '../shared/money';
import { type ProductChoice, productLabel, toProductLines } from '../shared/product-lines';
import { type ArtiloField, toMappingFields } from '../shared/record-fields';
import { buildWriteBody, EMPTY_REQUEST_ID_MESSAGE } from '../shared/record-write';
import { type ArtiloResource, isArtiloResource, RESOURCES } from '../shared/resources';
import { searchQueryOf } from '../shared/search';
import { artiloRequest } from '../shared/transport';
import { clientFields, clientOperations } from './ClientDescription';
import { companyFields, companyOperations } from './CompanyDescription';
import { dealFields, dealOperations } from './DealDescription';
import { leadFields, leadOperations } from './LeadDescription';

/** The most `GET /products/choices` returns at once; the list loads the next page on scroll. */
const PRODUCT_PAGE_SIZE = 50;

/** Errors from the helpers already carry their message and item; others are wrapped. */
const asNodeError = (
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
): NodeApiError | NodeOperationError =>
	error instanceof NodeApiError || error instanceof NodeOperationError
		? error
		: new NodeOperationError(context.getNode(), error as Error, { itemIndex });

async function loadFields(
	this: ILoadOptionsFunctions,
	action: 'create' | 'update',
): Promise<ResourceMapperFields> {
	const resource = String(this.getNodeParameter('resource', 'lead'));
	const { path } = RESOURCES[isArtiloResource(resource) ? resource : 'lead'];
	const response = await artiloRequest.call(this, {
		method: 'GET',
		path: `/${path}/fields`,
		qs: { action },
	});
	const fields = Array.isArray(response.body) ? (response.body as ArtiloField[]) : [];
	return { fields: toMappingFields(fields) };
}

async function findRecords(
	this: IExecuteFunctions,
	resource: ArtiloResource,
	itemIndex: number,
): Promise<IDataObject[]> {
	const { path, noun } = RESOURCES[resource];
	const query = searchQueryOf(resource, {
		searchBy: String(this.getNodeParameter('searchBy', itemIndex, '')),
		value: String(this.getNodeParameter('value', itemIndex, '')),
		country: String(this.getNodeParameter('country', itemIndex, '')),
		registrationNumber: String(this.getNodeParameter('registrationNumber', itemIndex, '')),
	});
	if (query.kind === 'invalid') {
		throw new NodeOperationError(this.getNode(), query.message, { itemIndex });
	}
	const response = await artiloRequest.call(this, {
		method: 'GET',
		path: `/${path}/search`,
		qs: query.qs,
		itemIndex,
	});
	const records = Array.isArray(response.body) ? (response.body as IDataObject[]) : [];
	if (records.length > 1) {
		throw new NodeOperationError(
			this.getNode(),
			`More than one ${noun.toLowerCase()} has this email. Search by Artilo ID instead.`,
			{ itemIndex },
		);
	}
	return records;
}

function recordPath(this: IExecuteFunctions, resource: ArtiloResource, itemIndex: number): string {
	const { path, noun, idParameter } = RESOURCES[resource];
	const id = String(this.getNodeParameter(idParameter, itemIndex, '')).trim();
	if (!id) {
		throw new NodeOperationError(
			this.getNode(),
			`${noun} ID is empty. Map the Artilo ID of the ${noun.toLowerCase()}, for example from a Find ${noun} step, and check it was found before this step.`,
			{ itemIndex },
		);
	}
	return `/${path}/${encodeURIComponent(id)}`;
}

/** A new deal's product lines, sent next to `values`. */
function productLinesOf(
	this: IExecuteFunctions,
	resource: ArtiloResource,
	operation: 'create' | 'update',
	itemIndex: number,
): IDataObject {
	if (resource !== 'deal' || operation !== 'create') {
		return {};
	}
	const collection = this.getNodeParameter('productLines', itemIndex, {}) as IDataObject;
	const lines = toProductLines(collection.lines);
	return lines.length > 0 ? { products: lines as IDataObject[] } : {};
}

async function writeRecord(
	this: IExecuteFunctions,
	resource: ArtiloResource,
	operation: 'create' | 'update',
	itemIndex: number,
): Promise<IDataObject> {
	const body = buildWriteBody(
		String(this.getNodeParameter('requestId', itemIndex, '')),
		// Unvalidated: n8n would refuse a blank number or date, or turn it into 0,
		// before the blanks could be dropped. Artilo checks every value itself.
		this.getNodeParameter('fields.value', itemIndex, {}, { skipValidation: true }) as IDataObject,
	);
	if (!body) {
		throw new NodeOperationError(this.getNode(), EMPTY_REQUEST_ID_MESSAGE, { itemIndex });
	}
	const path =
		operation === 'create'
			? `/${RESOURCES[resource].path}`
			: recordPath.call(this, resource, itemIndex);
	const response = await artiloRequest.call(this, {
		method: operation === 'create' ? 'POST' : 'PATCH',
		path,
		body: {
			requestId: body.requestId,
			values: body.values as IDataObject,
			...productLinesOf.call(this, resource, operation, itemIndex),
		},
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
		description: 'Find, create and update leads, clients, companies and deals in Artilo',
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
				options: [
					{ name: 'Client', value: 'client' },
					{ name: 'Company', value: 'company' },
					{ name: 'Deal', value: 'deal' },
					{ name: 'Lead', value: 'lead' },
				],
				// Workflows saved before the other resources store no resource
				default: 'lead',
			},
			...clientOperations,
			...companyOperations,
			...dealOperations,
			...leadOperations,
			...clientFields,
			...companyFields,
			...dealFields,
			...leadFields,
		],
	};

	methods = {
		listSearch: {
			async searchProducts(
				this: ILoadOptionsFunctions,
				_filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				const offset = Number(paginationToken) || 0;
				const response = await artiloRequest.call(this, {
					method: 'GET',
					path: '/products/choices',
					qs: { limit: PRODUCT_PAGE_SIZE, offset },
				});
				const products = Array.isArray(response.body) ? (response.body as ProductChoice[]) : [];
				return {
					results: products.map((product) => ({ name: productLabel(product), value: product.id })),
					...(products.length === PRODUCT_PAGE_SIZE && {
						paginationToken: String(offset + PRODUCT_PAGE_SIZE),
					}),
				};
			},
		},
		resourceMapping: {
			async getCreateFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				return loadFields.call(this, 'create');
			},
			async getUpdateFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				return loadFields.call(this, 'update');
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = String(this.getNodeParameter('resource', itemIndex));
				if (!isArtiloResource(resource)) {
					throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, {
						itemIndex,
					});
				}
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const results =
					operation === 'find'
						? await findRecords.call(this, resource, itemIndex)
						: [await writeRecord.call(this, resource, operation as 'create' | 'update', itemIndex)];
				for (const result of results) {
					// Deals read their total as a decimal, as the trigger's deal events do
					const json = resource === 'deal' ? withDecimalTotal(result) : result;
					returnData.push({ json, pairedItem: { item: itemIndex } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw asNodeError(this, error, itemIndex);
			}
		}

		return [returnData];
	}
}
