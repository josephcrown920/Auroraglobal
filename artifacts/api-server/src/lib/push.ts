import { db, pushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

/**
 * Send an Expo push notification to all registered tokens for a user.
 * Fire-and-forget — errors are logged but not thrown.
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    const rows = await db
      .select({ token: pushTokensTable.token })
      .from(pushTokensTable)
      .where(eq(pushTokensTable.userId, userId));

    if (rows.length === 0) return;

    const messages: PushMessage[] = rows.map((r) => ({
      to: r.token,
      title,
      body,
      sound: "default",
      data: data ?? {},
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[push] Expo push API error:", response.status, text);
    } else {
      const json = (await response.json()) as any;
      // Log any per-ticket errors (invalid tokens etc.)
      const tickets: any[] = json?.data ?? [];
      for (const ticket of tickets) {
        if (ticket.status === "error") {
          console.warn("[push] Ticket error:", ticket.message, ticket.details);
        }
      }
    }
  } catch (err: any) {
    console.error("[push] Failed to send push notification:", err?.message);
  }
}
