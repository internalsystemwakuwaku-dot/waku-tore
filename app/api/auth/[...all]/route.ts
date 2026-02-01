import { auth } from "@/lib/auth/config";
import { toNextJsHandler } from "better-auth/next-js";

// ビルド時にはスキップ
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const { POST, GET } = toNextJsHandler(auth);

