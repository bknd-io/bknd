export type TEmailResponse<Data = unknown> = {
   success: boolean;
   data?: Data;
};

export interface IEmailDriver<Data = unknown, Options = object> {
   send(
      to: string,
      subject: string,
      body: string | { text: string; html: string },
      options?: Options,
   ): Promise<TEmailResponse<Data>>;
}
