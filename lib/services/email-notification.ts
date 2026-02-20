/**
 * Email reminder service (standalone mobile)
 * Uses Resend HTTP API directly from the app.
 */


export interface EmailNotificationPayload {
  recipientEmail: string;
  subject: string;
  message: string;
}

export interface EmailNotificationResponse {
  success: boolean;
  id?: string;
  error?: string;
}

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
}

export async function sendEmailNotification(
  payload: EmailNotificationPayload,
): Promise<EmailNotificationResponse> {
  try {
    const apiKey = process.env.EXPO_PUBLIC_RESEND_API_KEY || "";
    const sender = process.env.EXPO_PUBLIC_ALERT_SENDER_EMAIL || "";

    if (!apiKey || !sender) {
      return { success: false, error: "未配置发件邮箱或环境变量 EXPO_PUBLIC_RESEND_API_KEY" };
    }

    const body: ResendPayload = {
      from: sender,
      to: [payload.recipientEmail],
      subject: payload.subject,
      text: payload.message,
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string };

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `邮件发送失败 (${response.status})`,
      };
    }

    return { success: true, id: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "邮件发送失败",
    };
  }
}
