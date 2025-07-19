// deno-fmt-ignore-file
// biome-ignore format: generated types do not need formatting
// prettier-ignore
import type { PathsForPages, GetConfigResponse } from 'waku/router';

// prettier-ignore
import type { getConfig as File_About_getConfig } from './pages/about';
// prettier-ignore
import type { getConfig as File_AdminAdmin_getConfig } from './pages/admin/[...admin]';
// prettier-ignore
import type { getConfig as File_Index_getConfig } from './pages/index';

// prettier-ignore
type Page =
| ({ path: '/about' } & GetConfigResponse<typeof File_About_getConfig>)
| ({ path: '/admin/[...admin]' } & GetConfigResponse<typeof File_AdminAdmin_getConfig>)
| { path: '/admin'; render: 'dynamic' }
| ({ path: '/' } & GetConfigResponse<typeof File_Index_getConfig>)
| { path: '/login'; render: 'dynamic' }
| { path: '/test'; render: 'dynamic' };

// prettier-ignore
declare module 'waku/router' {
  interface RouteConfig {
    paths: PathsForPages<Page>;
  }
  interface CreatePagesConfig {
    pages: Page;
  }
}
