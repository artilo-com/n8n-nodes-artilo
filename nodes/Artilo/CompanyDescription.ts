import type { INodeProperties } from 'n8n-workflow';
import { recordOperations, recordWriteFields } from './RecordDescription';

const find = { resource: ['company'], operation: ['find'] };

export const companyOperations: INodeProperties[] = [
	recordOperations(
		'company',
		'Find a company by its country and registration number, or its Artilo ID',
	),
];

const findFields: INodeProperties[] = [
	{
		displayName: 'Search By',
		name: 'searchBy',
		type: 'options',
		options: [
			{ name: 'Artilo ID', value: 'artiloId' },
			{ name: 'Country and Registration Number', value: 'registration' },
		],
		default: 'registration',
		displayOptions: { show: find },
	},
	{
		displayName: 'Artilo ID',
		name: 'value',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { ...find, searchBy: ['artiloId'] } },
		description:
			'The Artilo ID of the company. No match returns no items, so the branch stops unless Always Output Data is on in the node settings.',
	},
	{
		displayName: 'Country',
		name: 'country',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'IL',
		displayOptions: { show: { ...find, searchBy: ['registration'] } },
		description: 'An ISO 3166-1 alpha-2 country code, in any case',
	},
	{
		displayName: 'Registration Number',
		name: 'registrationNumber',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { ...find, searchBy: ['registration'] } },
		description:
			'Matched exactly: case and spaces count, leading and trailing ones included. No match returns no items, so the branch stops unless Always Output Data is on in the node settings.',
	},
];

export const companyFields: INodeProperties[] = [...findFields, ...recordWriteFields('company')];
