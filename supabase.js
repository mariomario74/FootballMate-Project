import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://yjgxebkdedhtjmdqtisn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZ3hlYmtkZWRodGptZHF0aXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMzc2MDEsImV4cCI6MjA3OTgxMzYwMX0.yymrFKHJ-ONO4SZIJuo14oFBNsTLxcS9AcRMJLivFVI';

export const supabase = createClient(supabaseUrl, supabaseKey);