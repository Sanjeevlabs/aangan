import { redirect } from "next/navigation";

// Privacy controls now live in Settings.
export default function PrivacyRedirect() {
  redirect("/settings");
}
