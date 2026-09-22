import nodemailer from "nodemailer";

/**
 * Sending mail over SMTP. SECURITY (docs/decisions/0005-email-account-secrets.md): the password is decrypted only by the service that
 * sends, held in memory for one call, and never logged. Certificates are always validated. Every failure is turned into one plain sentence;
 * the server's raw response is neither shown nor stored.
 */

export type SmtpConfig = { host: string; port: number; security: "SSL_TLS" | "STARTTLS"; username: string; password: string };

export type OutgoingMail = {
  from: string;
  replyTo: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  attachment: { filename: string; content: Buffer; contentType: string } | null;
};

type ErrorLike = { code?: unknown; responseCode?: unknown; message?: unknown };

/** A plain sentence for a person. Never the raw error. */
export function describeSmtpError(error: unknown): string {
  const e = (typeof error === "object" && error !== null ? error : {}) as ErrorLike;
  const code = typeof e.code === "string" ? e.code : "";
  const text = typeof e.message === "string" ? e.message : "";
  const response = typeof e.responseCode === "number" ? e.responseCode : 0;

  if (code === "EAUTH" || response === 535 || /invalid login|authentication failed|auth.*failed/i.test(text)) return "Sign-in failed. Check the username and password.";
  if (/^(ETLS|CERT_|DEPTH_ZERO|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS)/.test(code) || /certificate|handshake|wrong version number/i.test(text)) return "The server's security certificate could not be verified.";
  if (code === "ENOTFOUND" || code === "EDNS" || code === "EAI_AGAIN") return "The mail server address was not found.";
  if (code === "ECONNECTION" || code === "ECONNREFUSED" || code === "ECONNRESET" || code === "EHOSTUNREACH" || code === "ENETUNREACH") return "The mail server could not be reached.";
  if (code === "ETIMEDOUT" || code === "ESOCKET" || /timed? ?out/i.test(text)) return "The mail server did not respond in time.";
  if (code === "EENVELOPE" || response === 550 || response === 553 || response === 554) return "The mail server did not accept the sender or a recipient address.";
  return "The mail server returned an error.";
}

function transport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.security === "SSL_TLS",
    requireTLS: config.security === "STARTTLS",
    auth: { user: config.username, pass: config.password },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 30_000,
    tls: { rejectUnauthorized: true },
    logger: false,
  });
}

export type SmtpResult<T = object> = ({ ok: true } & T) | { ok: false; message: string };

/** Connects and signs in, sends nothing. */
export async function verifySmtp(config: SmtpConfig): Promise<SmtpResult> {
  const mailer = transport(config);
  try {
    await mailer.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: describeSmtpError(error) };
  } finally {
    mailer.close();
  }
}

/** Sends one message. Returns the Message-ID the server accepted it under, or a plain reason. */
export async function sendSmtpMail(config: SmtpConfig, mail: OutgoingMail): Promise<SmtpResult<{ messageId: string }>> {
  const mailer = transport(config);
  try {
    const info = await mailer.sendMail({
      from: mail.from,
      replyTo: mail.replyTo ?? undefined,
      to: mail.to,
      cc: mail.cc.length ? mail.cc : undefined,
      bcc: mail.bcc.length ? mail.bcc : undefined,
      subject: mail.subject,
      text: mail.text,
      attachments: mail.attachment ? [{ filename: mail.attachment.filename, content: mail.attachment.content, contentType: mail.attachment.contentType }] : undefined,
    });
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    return { ok: false, message: describeSmtpError(error) };
  } finally {
    mailer.close();
  }
}
