import { mergeObject, type RecursivePartial } from "core/utils";
import type { IEmailDriver } from "./index";

export type MailchannelsEmailOptions = {
   apiKey: string;
   host?: string;
   from?: { email: string; name: string };
};

export type Recipient = {
   email: string;
   name?: string;
};

export type MailchannelsSendOptions = RecursivePartial<{
   attachments: Array<{
      content: string;
      filename: string;
      type: string;
   }>;
   campaign_id: string;
   content: Array<{
      template_type?: string;
      type: string;
      value: string;
   }>;
   dkim_domain: string;
   dkim_private_key: string;
   dkim_selector: string;
   from: Recipient;
   headers: {};
   personalizations: Array<{
      bcc: Array<Recipient>;
      cc: Array<Recipient>;
      dkim_domain: string;
      dkim_private_key: string;
      dkim_selector: string;
      dynamic_template_data: {};
      from: Recipient;
      headers: {};
      reply_to: Recipient;
      subject: string;
      to: Array<Recipient>;
   }>;
   reply_to: Recipient;
   subject: string;
   tracking_settings: {
      click_tracking: {
         enable: boolean;
      };
      open_tracking: {
         enable: boolean;
      };
   };
   transactional: boolean;
}>;

export type MailchannelsEmailResponse = {
   request_id: string;
   results: Array<{
      index: number;
      message_id: string;
      reason: string;
      status: string;
   }>;
};

export const mailchannelsEmail = (
   config: MailchannelsEmailOptions,
): IEmailDriver<MailchannelsEmailResponse, MailchannelsSendOptions> => {
   const host = config.host ?? "https://api.mailchannels.net/tx/v1/send";
   const from = config.from ?? { email: "onboarding@mailchannels.net", name: "Mailchannels" };
   return {
      send: async (
         to: string,
         subject: string,
         body: string | { text: string; html: string },
         options?: MailchannelsSendOptions,
      ) => {
         const payload: MailchannelsSendOptions = mergeObject(
            {
               from,
               subject,
               content:
                  typeof body === "string"
                     ? [{ type: "text/html", value: body }]
                     : [
                          { type: "text/plain", value: body.text },
                          { type: "text/html", value: body.html },
                       ],
               personalizations: [
                  {
                     to: [{ email: to }],
                  },
               ],
            },
            options,
         );

         const res = await fetch(host, {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               "X-Api-Key": config.apiKey,
            },
            body: JSON.stringify({ ...payload, ...options }),
         });

         if (res.ok) {
            const data = (await res.json()) as MailchannelsEmailResponse;
            return { success: true, data };
         }
         return { success: false };
      },
   };
};
