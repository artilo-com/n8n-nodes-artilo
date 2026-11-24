import type { INodeProperties } from 'n8n-workflow';
import { type ArtiloResource, RESOURCES } from '../shared/resources';

const lower = (noun: string): string => noun.toLowerCase();

/** Create, Find and Update for one resource. */
export const recordOperations = (
	resource: ArtiloResource,
	findDescription: string,
): INodeProperties => {
	const noun = lower(RESOURCES[resource].noun);
	return {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: `Create a new ${noun}`,
				action: `Create a ${noun}`,
			},
			{ name: 'Find', value: 'find', description: findDescription, action: `Find a ${noun}` },
			{
				name: 'Update',
				value: 'update',
				description: `Update a ${noun} by its Artilo ID`,
				action: `Update a ${noun}`,
			},
		],
		default: 'create',
	};
};

const fieldsMapper = (
	resource: ArtiloResource,
	operation: 'create' | 'update',
): INodeProperties => ({
	displayName: 'Fields',
	name: 'fields',
	type: 'resourceMapper',
	noDataExpression: true,
	required: true,
	default: { mappingMode: 'defineBelow', value: null },
	displayOptions: { show: { resource: [resource], operation: [operation] } },
	typeOptions: {
		loadOptionsDependsOn: ['resource', 'operation'],
		resourceMapper: {
			resourceMapperMethod: operation === 'create' ? 'getCreateFields' : 'getUpdateFields',
			mode: 'add',
			addAllFields: false,
			supportAutoMap: false,
			fieldWords: { singular: 'field', plural: 'fields' },
		},
	},
});

/**
 * The parameters of a create and an update: the notice, the Artilo ID of the
 * record to update, the Request ID and the fields, loaded from Artilo.
 */
export const recordWriteFields = (resource: ArtiloResource): INodeProperties[] => {
	const { noun, idParameter } = RESOURCES[resource];
	const writes = { resource: [resource], operation: ['create', 'update'] };
	return [
		{
			displayName: `This action writes real data to Artilo, also when you test it in the editor, and the write may run your Artilo automations. Sending the same Request ID again returns the ${lower(noun)} already saved instead of writing twice. Blank values are skipped and never clear what the ${lower(noun)} holds.`,
			name: 'writeNotice',
			type: 'notice',
			default: '',
			displayOptions: { show: writes },
		},
		{
			displayName: `${noun} ID`,
			name: idParameter,
			type: 'string',
			required: true,
			default: '',
			displayOptions: { show: { resource: [resource], operation: ['update'] } },
			description: `The Artilo ID of the ${lower(noun)} to update, for example from Find ${noun}`,
		},
		{
			displayName: 'Request ID',
			name: 'requestId',
			type: 'string',
			required: true,
			default: '',
			displayOptions: { show: writes },
			description:
				'A unique, stable ID of what this write comes from, such as the form submission or order ID. Never a timestamp or a random value: when a run is retried or rerun, the same Request ID makes Artilo return what it already saved instead of writing twice.',
		},
		fieldsMapper(resource, 'create'),
		fieldsMapper(resource, 'update'),
	];
};

/** The Search By choice of a resource found by Artilo ID or email. */
export const idOrEmailSearchFields = (resource: 'lead' | 'client'): INodeProperties[] => {
	const plural = `${resource}s`;
	const find = { resource: [resource], operation: ['find'] };
	return [
		{
			displayName: 'Search By',
			name: 'searchBy',
			type: 'options',
			options: [
				{ name: 'Artilo ID', value: 'artiloId' },
				{ name: 'Email', value: 'email' },
			],
			default: 'email',
			displayOptions: { show: find },
			description: `Email matches in any case. When several ${plural} share an email the step stops and asks you to search by Artilo ID instead.`,
		},
		{
			displayName: 'Value',
			name: 'value',
			type: 'string',
			required: true,
			default: '',
			displayOptions: { show: find },
			description:
				'The Artilo ID or email to look for. No match returns no items, so the branch stops unless Always Output Data is on in the node settings.',
		},
	];
};
