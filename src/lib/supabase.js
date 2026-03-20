import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bqrvowpfanmbjlqeslem.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcnZvd3BmYW5tYmpscWVzbGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzg5NDUsImV4cCI6MjA4ODc1NDk0NX0.Mz3ajwfAbsy3sS4Kk5c419pz9a6GJRBdPqFCZJ3DUhI'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
