import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { headers } from "next/headers";

// ビルド時にはページデータ収集をスキップ
export const dynamic = "force-dynamic";

// メインページ - セッション確認後にボードまたはログインへリダイレクト
export default async function HomePage() {
  // セッション確認
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // 未認証の場合はログインへ、認証済みの場合はボードへ
  if (!session) {
    redirect("/login");
  } else {
    redirect("/board");
  }
}
