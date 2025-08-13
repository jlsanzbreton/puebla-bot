/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  [key: string]: string | boolean | undefined;
}

// Uncomment this to ensure ImportMeta.env is properly typed
// interface ImportMeta {
//   readonly env: ImportMetaEnv;
// }