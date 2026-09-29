import Link from "next/link";
import { EmptyState } from "@/components/ui";
export default function NotFound() { return <main id="main" className="page-shell not-found"><EmptyState title="페이지를 찾을 수 없어요" description="주소를 확인하거나 Floww 홈으로 돌아가세요." /><Link className="button primary" href="/">홈으로 돌아가기</Link></main>; }
