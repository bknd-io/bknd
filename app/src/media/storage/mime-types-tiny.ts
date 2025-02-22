export const Q = {
   video: ["mp4", "webm"],
   audio: ["ogg"],
   image: ["jpeg", "png", "gif", "webp", "bmp", "tiff", "avif", "heic", "heif"],
   text: ["html", "css", "mdx", "yaml", "vcard", "csv", "vtt"],
   application: ["zip", "xml", "toml", "json", "json5"],
   font: ["woff", "woff2", "ttf", "otf"]
} as const;

// reduced
const c = {
   vnd: "vnd.openxmlformats-officedocument",
   z: "application/x-7z-compressed",
   t: (w = "plain") => `text/${w}`,
   a: (w = "octet-stream") => `application/${w}`,
   i: (w) => `image/${w}`,
   v: (w) => `video/${w}`
} as const;
export const M = new Map<string, string>([
   ["7z", c.z],
   ["7zip", c.z],
   ["ai", c.a("pdf")],
   ["apk", c.a("vnd.android.package-archive")],
   ["doc", c.a("msword")],
   ["docx", `${c.vnd}.wordprocessingml.document`],
   ["eps", c.a("postscript")],
   ["epub", c.a("epub+zip")],
   ["ini", c.t()],
   ["jar", c.a("java-archive")],
   ["jsonld", c.a("ld+json")],
   ["jpg", c.i("jpeg")],
   ["log", c.t()],
   ["m3u", c.t()],
   ["m3u8", c.a("vnd.apple.mpegurl")],
   ["manifest", c.t("cache-manifest")],
   ["md", c.t("markdown")],
   ["mkv", c.v("x-matroska")],
   ["mp3", c.a("mpeg")],
   ["mobi", c.a("x-mobipocket-ebook")],
   ["ppt", c.a("powerpoint")],
   ["pptx", `${c.vnd}.presentationml.presentation`],
   ["qt", c.v("quicktime")],
   ["svg", c.i("svg+xml")],
   ["tif", c.i("tiff")],
   ["tsv", c.t("tab-separated-values")],
   ["tgz", c.a("x-tar")],
   ["txt", c.t()],
   ["text", c.t()],
   ["vcd", c.a("x-cdlink")],
   ["vcs", c.t("x-vcalendar")],
   ["wav", c.a("x-wav")],
   ["webmanifest", c.a("manifest+json")],
   ["xls", c.a("vnd.ms-excel")],
   ["xlsx", `${c.vnd}.spreadsheetml.sheet`],
   ["yml", c.t("yaml")]
]);

export function guess(f: string): string {
   try {
      const e = f.split(".").pop() as string;
      if (!e) {
         return c.a();
      }

      // try quick first
      for (const [t, _e] of Object.entries(Q)) {
         // @ts-ignore
         if (_e.includes(e)) {
            return `${t}/${e}`;
         }
      }

      return M.get(e!) as string;
   } catch (e) {
      return c.a();
   }
}

export function isMimeType(_mime: any, exclude: string[] = []) {
   const mime = _mime.toLowerCase();
   if (exclude.includes(mime)) return false;

   // try quick first
   if (
      Object.entries(Q)
         .flatMap(([t, e]) => e.map((x) => `${t}/${x}`))
         .includes(mime)
   ) {
      return true;
   }

   for (const [k, v] of M.entries()) {
      if (v === mime && !exclude.includes(k)) {
         return true;
      }
   }
   return false;
}

export function extension(_mime: string) {
   const mime = _mime.toLowerCase();

   for (const [t, e] of Object.entries(Q)) {
      for (const _e of e) {
         if (mime === `${t}/${_e}`) {
            return _e;
         }
      }
   }

   for (const [k, v] of M.entries()) {
      if (v === mime) {
         return k;
      }
   }
   return "";
}
