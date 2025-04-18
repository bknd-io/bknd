export function headersToObject(headers: Headers): Record<string, string> {
   if (!headers) return {};
   return { ...Object.fromEntries(headers.entries()) };
}

export function pickHeaders(headers: Headers, keys: string[]): Record<string, string> {
   const obj = headersToObject(headers);
   const res = {};
   for (const key of keys) {
      if (obj[key]) {
         res[key] = obj[key];
      }
   }
   return res;
}

export function pickHeaders2(headers: Headers, keys: string[]): Headers {
   const newHeaders = new Headers();
   for (const key of keys) {
      if (headers.has(key)) {
         newHeaders.set(key, headers.get(key)!);
      }
   }
   return newHeaders;
}

export const replaceUrlParam = (urlString: string, params: Record<string, string>) => {
   let newString = urlString;
   for (const [k, v] of Object.entries(params)) {
      const reg = new RegExp(`/:${k}(?:{[^/]+})?`);
      newString = newString.replace(reg, `/${v}`);
   }
   return newString;
};

export function encodeSearch(obj, options?: { prefix?: string; encode?: boolean }) {
   let str = "";
   function _encode(str) {
      return options?.encode ? encodeURIComponent(str) : str;
   }

   for (const k in obj) {
      let tmp = obj[k];
      if (tmp !== void 0) {
         if (Array.isArray(tmp)) {
            for (let i = 0; i < tmp.length; i++) {
               if (str.length > 0) str += "&";
               str += `${_encode(k)}=${_encode(tmp[i])}`;
            }
         } else {
            if (typeof tmp === "object") {
               tmp = JSON.stringify(tmp);
            }

            if (str.length > 0) str += "&";
            str += `${_encode(k)}=${_encode(tmp)}`;
         }
      }
   }

   return (options?.prefix || "") + str;
}

export function decodeSearch(str) {
   function toValue(mix) {
      if (!mix) return "";
      const str = decodeURIComponent(mix);
      if (str === "false") return false;
      if (str === "true") return true;
      try {
         return JSON.parse(str);
      } catch (e) {
         return +str * 0 === 0 ? +str : str;
      }
   }

   let tmp: any;
   let k: string;
   const out = {};
   const arr = str.split("&");

   // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
   while ((tmp = arr.shift())) {
      tmp = tmp.split("=");
      k = tmp.shift();
      if (out[k] !== void 0) {
         out[k] = [].concat(out[k], toValue(tmp.shift()));
      } else {
         out[k] = toValue(tmp.shift());
      }
   }

   return out;
}

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
// biome-ignore lint/suspicious/noConstEnum: <explanation>
export const enum HttpStatus {
   // Informational responses (100–199)
   CONTINUE = 100,
   //SWITCHING_PROTOCOLS = 101,
   PROCESSING = 102,
   EARLY_HINTS = 103,

   // Successful responses (200–299)
   OK = 200,
   CREATED = 201,
   ACCEPTED = 202,
   NON_AUTHORITATIVE_INFORMATION = 203,
   //NO_CONTENT = 204,
   //RESET_CONTENT = 205,
   PARTIAL_CONTENT = 206,
   MULTI_STATUS = 207,
   ALREADY_REPORTED = 208,
   IM_USED = 226,

   // Redirection messages (300–399)
   MULTIPLE_CHOICES = 300,
   MOVED_PERMANENTLY = 301,
   FOUND = 302,
   SEE_OTHER = 303,
   //NOT_MODIFIED = 304,
   USE_PROXY = 305,
   TEMPORARY_REDIRECT = 307,
   PERMANENT_REDIRECT = 308,

   // Client error responses (400–499)
   BAD_REQUEST = 400,
   UNAUTHORIZED = 401,
   PAYMENT_REQUIRED = 402,
   FORBIDDEN = 403,
   NOT_FOUND = 404,
   METHOD_NOT_ALLOWED = 405,
   NOT_ACCEPTABLE = 406,
   PROXY_AUTHENTICATION_REQUIRED = 407,
   REQUEST_TIMEOUT = 408,
   CONFLICT = 409,
   GONE = 410,
   LENGTH_REQUIRED = 411,
   PRECONDITION_FAILED = 412,
   PAYLOAD_TOO_LARGE = 413,
   URI_TOO_LONG = 414,
   UNSUPPORTED_MEDIA_TYPE = 415,
   RANGE_NOT_SATISFIABLE = 416,
   EXPECTATION_FAILED = 417,
   IM_A_TEAPOT = 418,
   MISDIRECTED_REQUEST = 421,
   UNPROCESSABLE_ENTITY = 422,
   LOCKED = 423,
   FAILED_DEPENDENCY = 424,
   TOO_EARLY = 425,
   UPGRADE_REQUIRED = 426,
   PRECONDITION_REQUIRED = 428,
   TOO_MANY_REQUESTS = 429,
   REQUEST_HEADER_FIELDS_TOO_LARGE = 431,
   UNAVAILABLE_FOR_LEGAL_REASONS = 451,

   // Server error responses (500–599)
   INTERNAL_SERVER_ERROR = 500,
   NOT_IMPLEMENTED = 501,
   BAD_GATEWAY = 502,
   SERVICE_UNAVAILABLE = 503,
   GATEWAY_TIMEOUT = 504,
   HTTP_VERSION_NOT_SUPPORTED = 505,
   VARIANT_ALSO_NEGOTIATES = 506,
   INSUFFICIENT_STORAGE = 507,
   LOOP_DETECTED = 508,
   NOT_EXTENDED = 510,
   NETWORK_AUTHENTICATION_REQUIRED = 511,
}
// biome-ignore lint/suspicious/noConstEnum: <explanation>
export const enum HttpStatusEmpty {
   // Informational responses (100–199)
   SWITCHING_PROTOCOLS = 101,
   // Successful responses (200–299)
   NO_CONTENT = 204,
   RESET_CONTENT = 205,
   // Redirection messages (300–399)
   NOT_MODIFIED = 304,
}
