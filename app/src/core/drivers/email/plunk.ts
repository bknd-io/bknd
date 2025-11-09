import type { IEmailDriver } from "./index";

export type PlunkEmailOptions = {
	apiKey: string;
	host?: string;
	from?: string;
};

export type PlunkEmailSendOptions = {
	to?: string | string[];
	subscribed?: boolean;
	name?: string;
	from?: string;
	reply?: string;
	headers?: Record<string, string>;
};

export type PlunkEmailResponse = {
	success: boolean;
	emails: Array<{
		contact: {
			id: string;
			email: string;
		};
		email: string;
	}>;
	timestamp: string;
};

export const plunkEmail = (
	config: PlunkEmailOptions,
): IEmailDriver<PlunkEmailResponse, PlunkEmailSendOptions> => {
	const host = config.host ?? "https://api.useplunk.com/v1/send";
	const from = config.from;

	return {
		send: async (
			to: string,
			subject: string,
			body: string | { text: string; html: string },
			options?: PlunkEmailSendOptions,
		) => {
			// Determine recipients - options.to takes precedence if provided
			const recipients = options?.to ?? to;

			// Validate recipient count (Plunk max is 5)
			const recipientArray = Array.isArray(recipients)
				? recipients
				: [recipients];
			if (recipientArray.length > 5) {
				throw new Error(
					"Plunk supports a maximum of 5 recipients per email",
				);
			}

			// Build base payload
			const payload: any = {
				to: recipients,
				subject,
			};

			// Handle body - Plunk only accepts a single body field
			if (typeof body === "string") {
				payload.body = body;
			} else {
				// When both text and html are provided, send html (degrades gracefully)
				payload.body = body.html;
			}

			// Add optional fields from config
			if (from) {
				payload.from = from;
			}

			// Merge with additional options (excluding 'to' since we already handled it)
			const { to: _, ...restOptions } = options ?? {};

			const res = await fetch(host, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config.apiKey}`,
				},
				body: JSON.stringify({ ...payload, ...restOptions }),
			});

			if (!res.ok) {
				throw new Error(`Plunk API error: ${await res.text()}`);
			}

			return (await res.json()) as PlunkEmailResponse;
		},
	};
};
