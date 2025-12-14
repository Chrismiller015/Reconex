import * as Brevo from "@getbrevo/brevo";
import { env } from "@/env.mjs";
import { logger } from "@/lib/logger";

const transactionalApi = new Brevo.TransactionalEmailsApi();
transactionalApi.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, env.BREVO_API_KEY);

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  htmlContent: string; //placeholdercomment
};

export const sendTransactionalEmail = async ({ to, subject, htmlContent }: SendTransactionalEmailInput) => {
  try {
    await transactionalApi.sendTransacEmail({
      sender: {
        email: env.BREVO_SENDER_EMAIL ?? "noreply@example.com",
        name: "ReconEx",
      },
      to: [{ email: to }],
      subject,
      htmlContent,
    });
    logger.info({ to }, "Transactional email dispatched via Brevo");
  } catch (error) {
    logger.error({ err: error }, "Failed to send transactional email");
    throw error;
  }
};
