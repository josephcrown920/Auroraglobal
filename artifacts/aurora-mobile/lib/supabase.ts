import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tpzmvbczwahxajujvnrq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_SGO6FEm9zbgYEOsFqlSX8Q_dFVMJf4x";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
