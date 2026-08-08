import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_COOKIE, adminToken, timingSafeEqual } from "@/lib/admin-auth";

export const metadata = { title: "Sign in" };

// The form is built from searchParams (the error flag and the return path),
// so there is nothing worth prerendering. Render it per request instead.
export const instant = false;

async function signIn(formData: FormData) {
  "use server";

  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected || !timingSafeEqual(password, expected)) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, await adminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(next.startsWith("/admin") ? next : "/admin");
}

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const params = await searchParams;
  const failed = params.error === "1";
  const next = typeof params.next === "string" ? params.next : "/admin";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="text-[20px] font-medium tracking-tight">Curator sign in</h1>
      <p className="mt-2 text-[13px] text-[#707070]">
        For adding and correcting painting details.
      </p>

      <form action={signIn} className="mt-8">
        <input type="hidden" name="next" value={next} />

        <label htmlFor="password" className="block text-[13px]">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="mt-1.5 min-h-12 w-full border border-[#E5E5E5] px-3 text-[15px] focus:border-black focus:outline-none"
        />

        {failed && (
          <p role="alert" className="mt-2 text-[13px] text-[#B3261E]">
            That password does not match. Try again.
          </p>
        )}

        <button
          type="submit"
          className="mt-5 min-h-12 w-full border border-black text-[15px] active:bg-black active:text-white"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
