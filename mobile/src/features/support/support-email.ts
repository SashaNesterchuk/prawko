import { Alert, Linking } from "react-native";

export const SUPPORT_EMAIL = "mind.jar.app@gmail.com";

export function buildSupportMailtoUrl(options?: {
  subject?: string;
  body?: string;
}) {
  const params: string[] = [];

  if (options?.subject) {
    params.push(`subject=${encodeURIComponent(options.subject)}`);
  }

  if (options?.body) {
    params.push(`body=${encodeURIComponent(options.body)}`);
  }

  return params.length > 0
    ? `mailto:${SUPPORT_EMAIL}?${params.join("&")}`
    : `mailto:${SUPPORT_EMAIL}`;
}

export function buildGmailComposeUrl(options?: {
  subject?: string;
  body?: string;
}) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: SUPPORT_EMAIL,
  });

  if (options?.subject) {
    params.set("su", options.subject);
  }

  if (options?.body) {
    params.set("body", options.body);
  }

  return `https://mail.google.com/mail/?${params.toString()}`;
}

export async function openSupportEmail(options?: {
  subject?: string;
  body?: string;
  unavailableTitle?: string;
  unavailableMessage?: string;
}) {
  const mailtoUrl = buildSupportMailtoUrl(options);

  try {
    await Linking.openURL(mailtoUrl);
    return;
  } catch {
    // Native mail is often missing on simulators and Gmail-only devices.
  }

  try {
    await Linking.openURL(buildGmailComposeUrl(options));
    return;
  } catch {
    Alert.alert(
      options?.unavailableTitle ?? SUPPORT_EMAIL,
      options?.unavailableMessage ?? SUPPORT_EMAIL
    );
  }
}
