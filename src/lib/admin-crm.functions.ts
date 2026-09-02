// Admin CRM read/write boundary. Customer behavior remains in first-party events;
// this layer provides an operator-safe customer timeline and lifecycle record.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin.functions";

export const adminListCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("crm_customers")
      .select("*")
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminGetCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }: { context: { userId: string }; data: { userId: string } }) => {
    await assertAdmin(context.userId);
    if (!data?.userId) throw new Error("userId is required");

    const [{ data: customer, error: customerError }, { data: activities, error: activitiesError }, { data: events, error: eventsError }] = await Promise.all([
      supabaseAdmin.from("crm_customers").select("*").eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin.from("crm_activities").select("*").eq("user_id", data.userId).order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("events").select("id,name,category,entity_type,entity_id,path,payload,created_at").eq("user_id", data.userId).order("created_at", { ascending: false }).limit(200),
    ]);

    if (customerError) throw new Error(customerError.message);
    if (activitiesError) throw new Error(activitiesError.message);
    if (eventsError) throw new Error(eventsError.message);

    return { customer, activities: activities ?? [], events: events ?? [] };
  });

export const adminUpsertCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }: { context: { userId: string }; data: { userId: string; lifecycle_stage?: string; source?: string | null; company_name?: string | null; notes?: string | null; owner_user_id?: string | null } }) => {
    await assertAdmin(context.userId);
    if (!data?.userId) throw new Error("userId is required");
    const allowedStages = new Set(["lead", "trial", "active", "at_risk", "churned", "vip"]);
    if (data.lifecycle_stage && !allowedStages.has(data.lifecycle_stage)) throw new Error("Invalid lifecycle stage");

    const { data: customer, error } = await supabaseAdmin
      .from("crm_customers")
      .upsert({
        user_id: data.userId,
        lifecycle_stage: data.lifecycle_stage ?? "lead",
        source: data.source ?? null,
        company_name: data.company_name ?? null,
        notes: data.notes ?? null,
        owner_user_id: data.owner_user_id ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return customer;
  });

export const adminAddCustomerActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }: { context: { userId: string }; data: { userId: string; activity_type: string; title: string; body?: string | null; metadata?: Record<string, unknown> } }) => {
    await assertAdmin(context.userId);
    if (!data?.userId || !data.title || !data.activity_type) throw new Error("userId, activity_type and title are required");
    const { data: activity, error } = await supabaseAdmin
      .from("crm_activities")
      .insert({
        user_id: data.userId,
        activity_type: data.activity_type,
        title: data.title,
        body: data.body ?? null,
        metadata: data.metadata ?? {},
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return activity;
  });
