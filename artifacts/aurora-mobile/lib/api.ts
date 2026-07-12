import { supabase } from "@/lib/supabase";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_SGO6FEm9zbgYEOsFqlSX8Q_dFVMJf4x";

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "https://auroraperformancestudio.com";
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return {
    Authorization: `Bearer ${session.access_token}`,
    apikey: SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": "application/json",
  };
}

export interface GenerateParams {
  kind: "image" | "video" | "ugc";
  prompt: string;
  presetId?: string;
  referenceImageUrl?: string;
}

export interface Generation {
  id: string;
  created_at: string;
  output_url: string | null;
  prompt: string | null;
  kind: string;
  status: "ok" | "error" | "processing";
  error_message?: string | null;
}

export async function generateContent(params: GenerateParams): Promise<Generation> {
  const headers = await getAuthHeaders();
  const base = getApiBase();

  const body: Record<string, unknown> = {
    kind: params.kind,
    prompt: params.prompt,
  };
  if (params.presetId) body.preset_id = params.presetId;
  if (params.referenceImageUrl) body.reference_image_url = params.referenceImageUrl;

  const res = await fetch(`${base}/api/public/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    const msg = err.error || err.message || `HTTP ${res.status}`;
    if (msg.includes("credit") || msg.includes("balance")) {
      throw new Error("out_of_credits");
    }
    throw new Error(msg);
  }

  return res.json();
}

export async function getGallery(limit = 40): Promise<Generation[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("generations")
    .select("id, created_at, output_url, prompt, kind, status")
    .eq("user_id", user.id)
    .in("status", ["ok"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Generation[];
}

export interface UserProfile {
  credits_balance: number;
  display_name: string | null;
  avatar_url: string | null;
}

export async function getUserProfile(): Promise<UserProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .select("credits_balance, display_name, avatar_url")
    .eq("user_id", user.id)
    .single();

  if (error) throw error;
  return data as UserProfile;
}

export interface CreditTransaction {
  id: string;
  created_at: string;
  amount: number;
  description: string;
  balance_after: number;
}

export async function getCreditTransactions(limit = 20): Promise<CreditTransaction[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("credit_ledger")
    .select("id, created_at, amount, description, balance_after")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as CreditTransaction[];
}
