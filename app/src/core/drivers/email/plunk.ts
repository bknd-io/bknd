import type { IEmailDriver } from "./index";

export type PlunkEmailOptions = {
	apiKey: string;
	host?: string;
	from?: string;
};

export type PlunkEmailSendOptions = {
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
			const payload: any = {
			  from,
				to,
				subject,
			};

			if (typeof body === "string") {
				payload.body = body;
			} else {
				payload.body = body.html;
			}

			const res = await fetch(host, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config.apiKey}`,
				},
				body: JSON.stringify({ ...payload, ...options }),
			});

			if (!res.ok) {
				throw new Error(`Plunk API error: ${await res.text()}`);
			}

			return (await res.json()) as PlunkEmailResponse;
		},
	};
};
