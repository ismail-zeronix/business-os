import { describe, expect, it } from "vitest";
import { describeImapError } from "./imap";
import { describeSmtpError } from "./smtp";

const SECRET = "hunter2-super-secret";

describe("describeSmtpError", () => {
  it.each([
    [{ code: "EAUTH" }, "Sign-in failed. Check the username and password."],
    [{ responseCode: 535 }, "Sign-in failed. Check the username and password."],
    [{ message: "Invalid login: 535 5.7.8" }, "Sign-in failed. Check the username and password."],
    [{ code: "ESOCKET", message: "wrong version number" }, "The server's security certificate could not be verified."],
    [{ code: "DEPTH_ZERO_SELF_SIGNED_CERT" }, "The server's security certificate could not be verified."],
    [{ code: "ENOTFOUND" }, "The mail server address was not found."],
    [{ code: "ECONNREFUSED" }, "The mail server could not be reached."],
    [{ code: "ETIMEDOUT" }, "The mail server did not respond in time."],
    [{ message: "Connection timed out" }, "The mail server did not respond in time."],
    [{ code: "EENVELOPE" }, "The mail server did not accept the sender or a recipient address."],
    [{ responseCode: 550 }, "The mail server did not accept the sender or a recipient address."],
    [{ code: "SOMETHING_ELSE" }, "The mail server returned an error."],
    [null, "The mail server returned an error."],
    ["a string", "The mail server returned an error."],
    [undefined, "The mail server returned an error."],
  ])("%j", (error, expected) => expect(describeSmtpError(error)).toBe(expected));

  it("never repeats the raw error text (a password or server reply cannot leak)", () => {
    for (const error of [{ code: "X", message: `LOGIN ${SECRET} rejected` }, { message: SECRET }, { code: SECRET }, { responseCode: 421, message: `421 ${SECRET}` }]) {
      expect(describeSmtpError(error)).not.toContain(SECRET);
    }
  });
});

describe("describeImapError", () => {
  it.each([
    [{ authenticationFailed: true }, "Sign-in failed. Check the username and password."],
    [{ message: "AUTHENTICATIONFAILED" }, "Sign-in failed. Check the username and password."],
    [{ code: "CERT_HAS_EXPIRED" }, "The server's security certificate could not be verified."],
    [{ code: "ENOTFOUND" }, "The mail server address was not found."],
    [{ code: "ECONNRESET" }, "The mail server could not be reached."],
    [{ code: "ETIMEDOUT" }, "The mail server did not respond in time."],
    [{ serverResponseCode: "NONEXISTENT" }, "That folder was not found on the mail server."],
    [{ message: "Unknown Mailbox: INBOX.x" }, "That folder was not found on the mail server."],
    [{}, "The mail server returned an error."],
    [null, "The mail server returned an error."],
  ])("%j", (error, expected) => expect(describeImapError(error)).toBe(expected));

  it("never repeats the raw error text", () => {
    expect(describeImapError({ code: "X", message: `bad ${SECRET}` })).not.toContain(SECRET);
  });
});
