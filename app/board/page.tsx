import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { headers } from "next/headers";
import { BoardClient } from "./BoardClient";

// ビルド時にはページデータ収集をスキップ
export const dynamic = "force-dynamic";

// ボードページ（Server Component）
export default async function BoardPage() {
    // セッション確認
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    // 未認証の場合はログインへ
    if (!session) {
        redirect("/login");
    }

    return <BoardClient user={session.user} />;
}
