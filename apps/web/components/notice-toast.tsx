"use client";

// One-shot messages carried across a redirect as ?notice=<key> (e.g. a non-admin bounced off /admin). Shows the toast,
// then drops the param so a reload doesn't repeat it. Only known keys show anything.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export const NOTICES: Record<string, string> = {
  "admins-only": "Admins only. That page is for admins; you're back on your agents.",
};

export function NoticeToast() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const key = params.get("notice");

  useEffect(() => {
    if (!key) return;
    const message = NOTICES[key];
    if (message) toast(message, { id: `notice-${key}` });
    const rest = new URLSearchParams(params.toString());
    rest.delete("notice");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [key, params, pathname, router]);

  return null;
}
