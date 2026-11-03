import type { INodeProperties } from 'n8n-workflow';

const WRITE_NOTICE =
	'This action writes real data to Artilo, also when you test it in the editor, and the write may run your Artilo automations. Sending the same Request ID again returns the lead already saved instead of writing twice. Blank values are skipped and never clear what the lead holds.';

export const leadOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['lead'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new lead',
				action: 'Create a lead',
			},
			{
				name: 'Find',
				value: 'find',
				description: 'Find a lead by its Artilo ID or email',
				action: 'Find a lead',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a lead by its Artilo ID',
				action: 'Update a lead',
			},
		],
		default: 'create',
	},
];

const findFields: INodeProperties[] = [
	{
		displayName: 'Search By',
		name: 'searchBy',
		type: 'options',
		options: [
			{ name: 'Artilo ID', value: 'artiloId' },
			{ name: 'Email', value: 'email' },
		],
		default: 'email',
		displayOptions: { show: { resource: ['lead'], operation: ['find'] } },
		description:
			'Email matches in any case. When several leads share an email the step stops and asks you to search by Artilo ID instead.',
	},
	{
		displayName: 'Value',
		name: 'value',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['lead'], operation: ['find'] } },
		description:
			'The Artilo ID or email to look for. No match returns no items, so the branch stops unless Always Output Data is on in the node settings.',
	},
];

const writeFields: INodeProperties[] = [
	{
		displayName: WRITE_NOTICE,
		name: 'writeNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['lead'], operation: ['create', 'update'] } },
	},
	{
		displayName: 'Lead ID',
		name: 'leadId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['lead'], operation: ['update'] } },
		description: 'The Artilo ID of the lead to update, for example from Find Lead',
	},
	{
		displayName: 'Request ID',
		name: 'requestId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['lead'], operation: ['create', 'update'] } },
		description:
			'A unique, stable ID of what this write comes from, such as the form submission or order ID. Never a timestamp or a random value: when a run is retried or rerun, the same Request ID makes Artilo return what it already saved instead of writing twice.',
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'resourceMapper',
		noDataExpression: true,
		required: true,
		default: { mappingMode: 'defineBelow', value: null },
		displayOptions: { show: { resource: ['lead'], operation: ['create'] } },
		typeOptions: {
			loadOptionsDependsOn: ['operation'],
			resourceMapper: {
				resourceMapperMethod: 'getCreateFields',
				mode: 'add',
				addAllFields: false,
				supportAutoMap: false,
				fieldWords: { singular: 'field', plural: 'fields' },
			},
		},
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'resourceMapper',
		noDataExpression: true,
		required: true,
		default: { mappingMode: 'defineBelow', value: null },
		displayOptions: { show: { resource: ['lead'], operation: ['update'] } },
		typeOptions: {
			loadOptionsDependsOn: ['operation'],
			resourceMapper: {
				resourceMapperMethod: 'getUpdateFields',
				mode: 'add',
				addAllFields: false,
				supportAutoMap: false,
				fieldWords: { singular: 'field', plural: 'fields' },
			},
		},
	},
];

export const leadFields: INodeProperties[] = [...findFields, ...writeFields];
