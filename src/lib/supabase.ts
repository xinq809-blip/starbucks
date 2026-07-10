import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://srdsjhvrwbrabdwigexa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyZHNqaHZyd2JyYWJkd2lnZXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2Nzk5MDIsImV4cCI6MjA5OTI1NTkwMn0.Vd6KjcVB9slZSz85_1ZE8w8lZCKr74rfStebIPhM8vc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
