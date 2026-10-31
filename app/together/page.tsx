import { redirect } from "next/navigation";

// Visits and family holidays each have their own page now.
export default function TogetherPage() {
  redirect("/together/visits");
}
