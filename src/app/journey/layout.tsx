import { ProtectedExperience } from "@/components/protected-experience";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ProtectedExperience>{children}</ProtectedExperience>;
}
