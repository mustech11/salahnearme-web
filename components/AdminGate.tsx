import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * Presentation-only wrapper.
 *
 * Administrative authorisation must remain in app/admin/layout.tsx through
 * requireAdmin(). Never add client-side passwords, sessionStorage checks or
 * browser-only role checks here.
 */
export default function AdminGate({ children }: Props) {
  return <>{children}</>;
}