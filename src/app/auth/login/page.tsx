import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<p role="status" className="p-6">Opening sign-in…</p>}>
      <LoginForm />
    </Suspense>
  );
}
