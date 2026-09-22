/**
 * Who the quotation comes from, printed at the top of the customer's copy. Only what is known is filled in: a blank is left out of the
 * printout, never guessed. The tax registration number (TRN) is still to be added when confirmed.
 */
export const COMPANY = {
  name: "Zeronix Technology LLC",
  /** In /public. Black and green on a transparent background, for white paper. */
  logo: { src: "/brand/zeronix-logo-black.png", width: 679, height: 103 },
  /** One line each, printed as written. */
  address: ["Office 19, Khurram Building, Al Fahidi,", "Bur Dubai, Dubai, United Arab Emirates"],
  emails: ["info@zeronix.ae", "sales@zeronix.ae"],
  phones: ["+971 50 981 1669", "+971 55 824 6066", "+971 56 785 0662"],
  /** UAE tax registration number. */
  trn: null as string | null,
};
