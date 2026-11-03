import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IN8nHttpFullResponse,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { normalizeBaseUrl } from './base-url';
import { API_PREFIX, CREDENTIAL_NAME } from './constants';
import { artiloErrorMessage } from './errors';

const NETWORK_ERROR_CODES = new Set([
	'ECONNREFUSED',
	'ECONNRESET',
	'ENOTFOUND',
	'EAI_AGAIN',
	'ETIMEDOUT',
	'ECONNABORTED',
]);

/** A network failure means Artilo could not be reached; anything else keeps its own message. */
const unreachableMessage = (error: unknown): string => {
	const code = (error as { code?: unknown } | null)?.code;
	if (typeof code === 'string' && NETWORK_ERROR_CODES.has(code)) {
		return artiloErrorMessage(undefined, undefined);
	}
	return error instanceof Error ? error.message : artiloErrorMessage(undefined, undefined);
};

type ArtiloContext = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions;

interface ArtiloRequest {
	method: IHttpRequestMethods;
	path: string;
	body?: IDataObject;
	qs?: IDataObject;
	/** Answers that are not errors for this call, such as a 404 on unsubscribe. */
	acceptedStatuses?: number[];
	itemIndex?: number;
}

/**
 * One call to Artilo's integration API, authenticated with the credential's
 * key. A failed answer becomes a NodeApiError carrying Artilo's own message,
 * which already says what to fix.
 */
export async function artiloRequest(
	this: ArtiloContext,
	request: ArtiloRequest,
): Promise<IN8nHttpFullResponse> {
	const credentials = await this.getCredentials(CREDENTIAL_NAME);
	const baseUrl = normalizeBaseUrl(String(credentials.baseUrl ?? ''));
	if (!baseUrl) {
		throw new NodeOperationError(
			this.getNode(),
			'The Artilo URL in the credential must start with https:// (plain http is only allowed for localhost).',
		);
	}

	let response: IN8nHttpFullResponse;
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIAL_NAME, {
			method: request.method,
			url: `${baseUrl}${API_PREFIX}${request.path}`,
			body: request.body,
			qs: request.qs,
			json: true,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		})) as IN8nHttpFullResponse;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			message: unreachableMessage(error),
			itemIndex: request.itemIndex,
		});
	}

	const { statusCode, body } = response;
	if (statusCode >= 400 && !request.acceptedStatuses?.includes(statusCode)) {
		throw new NodeApiError(this.getNode(), { statusCode, body } as JsonObject, {
			message: artiloErrorMessage(statusCode, body),
			httpCode: String(statusCode),
			itemIndex: request.itemIndex,
		});
	}
	return response;
}
