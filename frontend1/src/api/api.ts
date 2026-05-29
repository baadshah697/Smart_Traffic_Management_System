import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project credentials
const supabaseUrl = 'https://zkimibxtwwiqqulpqdmj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpraW1pYnh0d3dpcXF1bHBxZG1qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQwNDIzNSwiZXhwIjoyMDg2OTgwMjM1fQ.YN1OGTtFMRvLYVwbFowwyDXGia1dFCMNqOl-m8vJ1eY';

// This is a "Named Export"
export const supabase = createClient(supabaseUrl, supabaseAnonKey);