import type { INodeProperties } from 'n8n-workflow';
import { idOrEmailSearchFields, recordOperations, recordWriteFields } from './RecordDescription';

export const clientOperations: INodeProperties[] = [
	recordOperations('client', 'Find a client by its Artilo ID or email'),
];

export const clientFields: INodeProperties[] = [
	...idOrEmailSearchFields('client'),
	...recordWriteFields('client'),
];
