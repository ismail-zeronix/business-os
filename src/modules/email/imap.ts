import { ImapFlow } from "imapflow";

/**
 * The only place that talks to a mail server. Rules (docs/decisions/0005-email-account-secrets.md):
 *  - the mailbox is opened READ-ONLY (IMAP EXAMINE): nothing is marked read, flagged, moved or deleted
 *  - TLS is always on and the certificate is always verified
 *  - the library's logger is off, so credentials can never reach a log
 *  - failures are mapped to short, fixed messages: the raw error (which could echo server text) is never returned, stored or shown
 * Relative imports only, so `scripts/` can use it.
 */

export type ImapConfig = {
  host: string;
  port: number;
  security: "SSL_TLS" | "STARTTLS";
  username: string;
  password: string;
  folder: string;
};

export function openClient(config: ImapConfig): ImapFlow {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.security === "SSL_TLS",
    doSTARTTLS: config.security === "STARTTLS" ? true : undefined,
    auth: { user: config.username, pass: config.password },
    logger: false,
    tls: { rejectUnauthorized: true },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
  // ImapFlow emits "error" events for socket problems; without a listener Node would treat them as uncaught and crash the server.
  // The same failure also rejects the pending call, which is where it is reported (sanitised).
  client.on("error", () => {});
  return client;
}

type ErrorLike = { code?: unknown; authenticationFailed?: unknown; serverResponseCode?: unknown; message?: unknown };

const TLS_CODES = new Set(["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "ERR_SSL_WRONG_VERSION_NUMBER"]);

/** A short, fixed, user-safe description of a failure. The original error text is never used, so nothing sensitive can leak through it. */
export function describeImapError(error: unknown): string {
  const e = (typeof error === "object" && error !== null ? error : {}) as ErrorLike;
  const code = typeof e.code === "string" ? e.code : "";
  const text = typeof e.message === "string" ? e.message : "";

  if (e.authenticationFailed === true || /AUTHENTICATIONFAILED|invalid credentials|authentication failed|login failed/i.test(text)) return "Sign-in failed. Check the username and password.";
  if (TLS_CODES.has(code) || /certificate|tls|ssl/i.test(code) || /certificate|handshake|wrong version number/i.test(text)) return "The server's security certificate could not be verified.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "The mail server address was not found.";
  if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "EHOSTUNREACH" || code === "ENETUNREACH") return "The mail server could not be reached.";
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT" || /timed? ?out/i.test(code) || /timed? ?out/i.test(text)) return "The mail server did not respond in time.";
  if (e.serverResponseCode === "NONEXISTENT" || /nonexistent|mailbox.*(not found|does not exist)|unknown mailbox|no such mailbox/i.test(text)) return "That folder was not found on the mail server.";
  return "The mail server returned an error.";
}

export type ImapTestResult = { ok: true; messageCount: number } | { ok: false; message: string };

/** Connects, opens the folder read-only and counts its messages. Stores nothing. Always closes the connection. */
export async function testImapConnection(config: ImapConfig): Promise<ImapTestResult> {
  const client = openClient(config);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(config.folder, { readOnly: true });
    let messageCount = 0;
    try {
      messageCount = typeof client.mailbox === "object" ? client.mailbox.exists : 0;
    } finally {
      lock.release();
    }
    await client.logout();
    return { ok: true, messageCount };
  } catch (error) {
    return { ok: false, message: describeImapError(error) };
  } finally {
    try {
      client.close();
    } catch {
      // already closed
    }
  }
}
