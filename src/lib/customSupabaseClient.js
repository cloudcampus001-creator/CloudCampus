import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rdgskgqtlswisdkifeth.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkZ3NrZ3F0bHN3aXNka2lmZXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NTI3NTcsImV4cCI6MjA3NDIyODc1N30.6prx61bkgHPD0-eparxQtc9Fqhp4ZDa1uDK59unOhz4';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
