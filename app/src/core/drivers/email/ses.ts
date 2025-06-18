import type { IEmailDriver } from "./index";
import { AwsClient } from "aws4fetch";

export type SesEmailOptions = {
   region: string;
   accessKeyId: string;
   secretAccessKey: string;
   from: string;
};

export type SesSendOptions = {
   cc?: string[];
   bcc?: string[];
   replyTo?: string[];
};

export type SesEmailResponse = {
   MessageId: string;
   status: number;
   body: string;
};

export const sesEmail = (
   config: SesEmailOptions,
): IEmailDriver<SesEmailResponse, SesSendOptions> => {
   const endpoint = `https://email.${config.region}.amazonaws.com/v2/email/outbound-emails`;
   const from = config.from;
   const aws = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: "ses",
      region: config.region,
   });
   return {
      send: async (
         to: string,
         subject: string,
         body: string | { text: string; html: string },
         options?: SesSendOptions,
      ) => {
         // SES v2 SendEmail JSON payload
         const payload: any = {
            FromEmailAddress: from,
            Destination: {
               ToAddresses: [to],
            },
            Content: {
               Simple: {
                  Subject: { Data: subject, Charset: "UTF-8" },
                  Body: {},
               },
            },
         };
         if (typeof body === "string") {
            payload.Content.Simple.Body.Html = { Data: body, Charset: "UTF-8" };
         } else {
            if (body.html) payload.Content.Simple.Body.Html = { Data: body.html, Charset: "UTF-8" };
            if (body.text) payload.Content.Simple.Body.Text = { Data: body.text, Charset: "UTF-8" };
         }
         if (options?.cc && options.cc.length > 0) {
            payload.Destination.CcAddresses = options.cc;
         }
         if (options?.bcc && options.bcc.length > 0) {
            payload.Destination.BccAddresses = options.bcc;
         }
         if (options?.replyTo && options.replyTo.length > 0) {
            payload.ReplyToAddresses = options.replyTo;
         }
         const res = await aws.fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
         });
         const text = await res.text();
         if (!res.ok) {
            // SES v2 returns JSON error body
            let errorMsg = text;
            try {
               const err = JSON.parse(text);
               errorMsg = err.message || err.Message || text;
            } catch {}
            throw new Error(`SES SendEmail failed: ${errorMsg}`);
         }
         // parse MessageId from JSON response
         let MessageId: string = "";
         try {
            const data = JSON.parse(text);
            MessageId = data.MessageId;
         } catch {}
         return { MessageId, status: res.status, body: text };
      },
   };
};
