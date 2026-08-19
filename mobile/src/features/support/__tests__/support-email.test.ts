import {
  SUPPORT_EMAIL,
  buildGmailComposeUrl,
  buildSupportMailtoUrl,
} from "../support-email";

describe("support email URLs", () => {
  it("points mailto at the Mind Jar support inbox", () => {
    expect(SUPPORT_EMAIL).toBe("mind.jar.app@gmail.com");
    expect(buildSupportMailtoUrl()).toBe("mailto:mind.jar.app@gmail.com");
  });

  it("encodes a subject for the mail composer", () => {
    expect(buildSupportMailtoUrl({ subject: "Prawko support" })).toBe(
      "mailto:mind.jar.app@gmail.com?subject=Prawko%20support"
    );
  });

  it("builds a Gmail compose fallback to the same inbox", () => {
    expect(buildGmailComposeUrl({ subject: "Prawko support" })).toBe(
      "https://mail.google.com/mail/?view=cm&fs=1&to=mind.jar.app%40gmail.com&su=Prawko+support"
    );
  });
});
