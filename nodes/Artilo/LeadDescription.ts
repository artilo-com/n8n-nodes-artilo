import type { INodeProperties } from 'n8n-workflow';
import { idOrEmailSearchFields, recordOperations, recordWriteFields } from './RecordDescription';

export const leadOperations: INodeProperties[] = [
	recordOperations('lead', 'Find a lead by its Artilo ID or email'),
];

export const leadFields: INodeProperties[] = [
	...idOrEmailSearchFields('lead'),
	...recordWriteFields('lead'),
];
