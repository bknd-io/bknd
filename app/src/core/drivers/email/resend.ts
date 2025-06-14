import type { IEmailDriver } from "./index";

export type ResendEmailOptions = {
   apiKey: string;
   host?: string;
   from?: string;
};

export type ResendEmailSendOptions = {
   bcc?: string | string[];
   cc?: string | string[];
   reply_to?: string | string[];
   scheduled_at?: string;
   headers?: Record<string, string>;
   attachments?: {
      content: Buffer | string;
      filename: string;
      path: string;
      content_type: string;
   }[];
   tags?: {
      name: string;
      value: string;
   }[];
};

export type ResendEmailResponse = {
   id: string;
};

export const resendEmail = (
   config: ResendEmailOptions,
): IEmailDriver<ResendEmailResponse, ResendEmailSendOptions> => {
   const host = config.host ?? "https://api.resend.com/emails";
   const from = config.from ?? "Acme <onboarding@resend.dev>";
   return {
      send: async (
         to: string,
         subject: string,
         body: string | { text: string; html: string },
         options?: ResendEmailSendOptions,
      ) => {
         const payload: any = {
            from,
            to,
            subject,
         };

         if (typeof body === "string") {
            payload.html = body;
         } else {
            payload.html = body.html;
            payload.text = body.text;
         }

         const res = await fetch(host, {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({ ...payload, ...options }),
         });

         if (res.ok) {
            const data = (await res.json()) as ResendEmailResponse;
            return { success: true, data };
         }
         return { success: false };
      },
   };
};
