import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://lzbzrfweffglbqxnzclr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6YnpyZndlZmZnbGJxeG56Y2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTIzMTEsImV4cCI6MjA3OTk4ODMxMX0.rQgCOev-tANdtHL-uQx-etE7sD32YjFrq9SezSf9c0I";

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);