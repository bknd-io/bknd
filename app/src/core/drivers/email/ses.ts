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
   MessageId?: string;
   status: number;
   body: string;
};

export const sesEmail = (
   config: SesEmailOptions,
): IEmailDriver<SesEmailResponse, SesSendOptions> => {
   const endpoint = `https://email.${config.region}.amazonaws.com/`;
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
         // build SES SendEmail params (x-www-form-urlencoded)
         const params: Record<string, string> = {
            Action: "SendEmail",
            Version: "2010-12-01",
            Source: from,
            "Destination.ToAddresses.member.1": to,
            "Message.Subject.Data": subject,
         };
         if (typeof body === "string") {
            params["Message.Body.Html.Data"] = body;
         } else {
            params["Message.Body.Html.Data"] = body.html;
            params["Message.Body.Text.Data"] = body.text;
         }
         if (options?.cc) {
            options.cc.forEach((cc, i) => {
               params[`Destination.CcAddresses.member.${i + 1}`] = cc;
            });
         }
         if (options?.bcc) {
            options.bcc.forEach((bcc, i) => {
               params[`Destination.BccAddresses.member.${i + 1}`] = bcc;
            });
         }
         if (options?.replyTo) {
            options.replyTo.forEach((reply, i) => {
               params[`ReplyToAddresses.member.${i + 1}`] = reply;
            });
         }
         const formBody = Object.entries(params)
            .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
            .join("&");
         const res = await aws.fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: formBody,
         });
         const text = await res.text();
         // try to extract MessageId from XML response
         let MessageId: string | undefined = undefined;
         const match = text.match(/<MessageId>([^<]+)<\/MessageId>/);
         if (match) MessageId = match[1];
         return {
            success: res.ok,
            data: { MessageId, status: res.status, body: text },
         };
      },
   };
};
