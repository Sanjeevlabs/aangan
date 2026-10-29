"use client";

import { useRouter } from "next/navigation";
import { RecipeEditor } from "@/components/recipe-editor";

export default function NewRecipePage() {
  const router = useRouter();
  return <RecipeEditor onDone={(id) => router.replace(id ? `/kitchen/${id}` : "/kitchen")} />;
}
