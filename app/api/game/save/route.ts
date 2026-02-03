import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { gameData } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * ゲームデータ保存API (sendBeacon用)
 * ページを離れる際の自動保存に使用
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, data } = body;

        if (!userId || !data) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        await db
            .update(gameData)
            .set({
                dataJson: JSON.stringify(data),
                updatedAt: new Date().toISOString(),
            })
            .where(eq(gameData.userId, userId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API /game/save] Error:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
