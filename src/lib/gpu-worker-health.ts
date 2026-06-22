/**
 * GPU worker health checks and status dashboard.
 * Monitors worker heartbeats, failure rates, and concurrency.
 */

export interface WorkerStatus {
  id: string;
  name: string;
  status: "online" | "offline" | "degraded";
  region: string;
  capabilities: string[];
  in_flight: number;
  max_concurrency: number;
  last_heartbeat: string;
  uptime_pct: number;
  failure_rate: number;
}

/**
 * Check if a worker is healthy based on:
 * - Recent heartbeat (< 60 seconds)
 * - Low failure rate (< 5%)
 * - Available capacity
 */
export function isWorkerHealthy(worker: WorkerStatus): boolean {
  const lastHeartbeatMs = Date.now() - new Date(worker.last_heartbeat).getTime();
  const isReachable = lastHeartbeatMs < 60_000; // 60 seconds
  const hasCapacity = worker.in_flight < worker.max_concurrency;
  const isReliable = worker.failure_rate < 0.05; // < 5% failure

  return isReachable && hasCapacity && isReliable;
}

/**
 * Cron job: periodic health check of all GPU workers.
 * Called every 5 minutes.
 * Updates worker status and routes around unhealthy instances.
 */
export async function checkGPUWorkerHealth(supabaseAdmin: any) {
  const { data: workers, error } = await supabaseAdmin
    .from("gpu_workers")
    .select("id, name, status, region, capabilities, in_flight, max_concurrency, last_heartbeat")
    .order("priority", { ascending: true });

  if (error || !workers) {
    console.error("Failed to fetch worker list:", error);
    return;
  }

  for (const worker of workers) {
    const lastHeartbeatMs = Date.now() - new Date(worker.last_heartbeat).getTime();
    const newStatus = lastHeartbeatMs < 60_000 ? "online" : "offline";

    if (worker.status !== newStatus) {
      await supabaseAdmin
        .from("gpu_workers")
        .update({ status: newStatus })
        .eq("id", worker.id);
    }
  }
}
