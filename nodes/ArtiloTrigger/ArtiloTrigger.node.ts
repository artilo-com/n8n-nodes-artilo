import type {
	IDataObject,
	IHookFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { CREDENTIAL_NAME, SIGNATURE_HEADER } from '../shared/constants';
import { withDecimalTotal } from '../shared/money';
import { checkSignature } from '../shared/signature';
import { subscriptionsOf } from '../shared/subscriptions';
import { artiloRequest } from '../shared/transport';

const DEAL_EVENTS = ['new_deal', 'deal_stage_changed'];

const SIGNATURE_REFUSALS = {
	missing: 'Missing X-Artilo-Signature header',
	invalid: 'Invalid signature',
	expired: 'Signature too old',
} as const;

const NO_RAW_BODY =
	'The raw request body is not available, so the signature cannot be checked';

async function loadChoices(
	this: ILoadOptionsFunctions,
	path: string,
	anyLabel: string,
): Promise<INodePropertyOptions[]> {
	const response = await artiloRequest.call(this, { method: 'GET', path });
	const choices = Array.isArray(response.body)
		? (response.body as Array<{ id: string; label: string }>)
		: [];
	return [
		{ name: anyLabel, value: '' },
		...choices.map((choice) => ({ name: choice.label, value: choice.id })),
	];
}

/** The status or stage the subscription is filtered on, or nothing. */
function filterOf(this: IHookFunctions, event: string): IDataObject {
	if (event === 'lead_status_changed') {
		const statusId = this.getNodeParameter('statusId', '') as string;
		return statusId ? { statusId } : {};
	}
	if (event === 'deal_stage_changed') {
		const stage = this.getNodeParameter('stage', '') as string;
		return stage ? { stage } : {};
	}
	return {};
}

/**
 * Ends a subscription. 404: Artilo already ended it. 401 and 403: the key was
 * revoked or lost access, and Artilo ended its subscriptions then.
 */
async function unsubscribe(this: IHookFunctions, subscriptionId: string): Promise<void> {
	await artiloRequest.call(this, {
		method: 'DELETE',
		path: `/subscriptions/${encodeURIComponent(subscriptionId)}`,
		acceptedStatuses: [401, 403, 404],
	});
}

/**
 * The exact bytes Artilo signed, read before n8n parsed them, or null. The
 * parsed body can't stand in: stringifying it again changes the bytes (non
 * ASCII characters, key order, spacing), so the signature would never match.
 */
function rawBodyOf(this: IWebhookFunctions): string | null {
	const rawBody: unknown = Reflect.get(this.getRequestObject(), 'rawBody');
	if (Buffer.isBuffer(rawBody)) {
		return rawBody.toString('utf8');
	}
	return typeof rawBody === 'string' ? rawBody : null;
}

export class ArtiloTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Artilo Trigger',
		name: 'artiloTrigger',
		icon: { light: 'file:../Artilo/artilo.svg', dark: 'file:../Artilo/artilo.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when a lead or deal changes in Artilo',
		defaults: { name: 'Artilo Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: CREDENTIAL_NAME, required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				required: true,
				options: [
					{
						name: 'Deal Stage Changed',
						value: 'deal_stage_changed',
						description: 'A deal moves to another stage',
					},
					{
						name: 'Lead Status Changed',
						value: 'lead_status_changed',
						description: 'A lead moves to another status, by hand or by an Artilo workflow',
					},
					{ name: 'New Deal', value: 'new_deal', description: 'A deal is created' },
					{ name: 'New Lead', value: 'new_lead', description: 'A lead is created' },
				],
				default: 'new_lead',
			},
			{
				displayName: 'Status Name or ID',
				name: 'statusId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getLeadStatuses' },
				default: '',
				displayOptions: { show: { event: ['lead_status_changed'] } },
				description:
					'Only start when a lead moves into this status. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Stage Name or ID',
				name: 'stage',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getDealStages' },
				default: '',
				displayOptions: { show: { event: ['deal_stage_changed'] } },
				description:
					'Only start when a deal moves into this stage. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	};

	methods = {
		loadOptions: {
			async getLeadStatuses(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return loadChoices.call(this, '/leads/statuses', 'Any Status');
			},
			async getDealStages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return loadChoices.call(this, '/deals/stages', 'Any Stage');
			},
		},
	};

	webhookMethods = {
		default: {
			// On a restart or a leader change the stored subscription is still
			// live, and subscribing again would rotate its secret while Artilo may
			// already be sending. Publishing always subscribes again, which also
			// recovers a subscription Artilo ended (a revoked key).
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const mode = this.getActivationMode();
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				return (
					(mode === 'init' || mode === 'leadershipChange') &&
					webhookUrl in subscriptionsOf(this.getWorkflowStaticData('node'))
				);
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const event = this.getNodeParameter('event') as string;
				const response = await artiloRequest.call(this, {
					method: 'POST',
					path: '/subscriptions',
					body: { trigger: event, targetUrl: webhookUrl, ...filterOf.call(this, event) },
				});
				const { id, signingSecret } = response.body as { id: string; signingSecret: string };
				const staticData = this.getWorkflowStaticData('node');
				const previous = subscriptionsOf(staticData)[webhookUrl];
				staticData.subscriptions = {
					...subscriptionsOf(staticData),
					[webhookUrl]: { id, signingSecret },
				};
				// The event changed: Artilo made a new subscription for this URL, so
				// the old one would keep sending events this trigger now refuses
				if (previous && previous.id !== id) {
					await unsubscribe.call(this, previous.id);
				}
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const staticData = this.getWorkflowStaticData('node');
				const { [webhookUrl]: subscription, ...others } = subscriptionsOf(staticData);
				// Forgotten whatever Artilo answers, so a later publish starts clean
				staticData.subscriptions = others;
				if (subscription) {
					await unsubscribe.call(this, subscription.id);
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const header = this.getHeaderData()[SIGNATURE_HEADER];
		const secrets = Object.values(subscriptionsOf(this.getWorkflowStaticData('node'))).map(
			(subscription) => subscription.signingSecret,
		);
		const rawBody = rawBodyOf.call(this);
		if (rawBody === null) {
			this.getResponseObject().status(401).json({ message: NO_RAW_BODY });
			return { noWebhookResponse: true };
		}
		const check = checkSignature(
			Array.isArray(header) ? header[0] : header,
			rawBody,
			secrets,
			Math.floor(Date.now() / 1000),
		);
		if (check !== 'valid') {
			this.getResponseObject().status(401).json({ message: SIGNATURE_REFUSALS[check] });
			return { noWebhookResponse: true };
		}

		const event = this.getBodyData();
		const isDealEvent = DEAL_EVENTS.includes(this.getNodeParameter('event') as string);
		return {
			workflowData: [this.helpers.returnJsonArray(isDealEvent ? withDecimalTotal(event) : event)],
		};
	}
}
