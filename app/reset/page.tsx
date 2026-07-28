import { Suspense } from "react";
import ResetForm from "@/components/ResetForm";

export const metadata = { title: "Choose a new password — Bracketline" };

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
