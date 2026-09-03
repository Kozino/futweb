/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_FLUTTERWAVE_PUBLIC_KEY?: string
  readonly VITE_APP_URL?: string
  readonly MODE: string
  readonly DEV: boolean
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
