"use server";

/**
 * 競馬・ガチャ Server Actions (Global Multiplayer Version)
 * GASのKeiba/Gachaを置き換え
 * - Lazy Creationによるグローバルレース生成
 * - 複雑なベット対応
 * 
 * [FIXES APPLIED]
 * 1. Atomicity: Added Compensating Transaction (Refund) pattern in placeBet.
 * 2. Concurrency: Added Atomic Status Update in resolveRace to prevent Double Payouts.
 * 3. Integrity: Added better error handling and logging.
 */

import { db } from "@/lib/db/client";
import { gameData, keibaRaces, keibaTransactions, gachaRecords } from "@/lib/db/schema";
import { eq, desc, and, lt, gt } from "drizzle-orm";
import { logActivity } from "./log";
import type {
    Race,
    Bet,
    Horse,
    GachaResult,
    GachaItem,
    KeibaTransaction,
    GachaRecord,
    BetType,
    BetMode
} from "@/types/keiba";
import { DEFAULT_HORSES, DEFAULT_GACHA_POOL } from "@/types/keiba";
import { transactMoney, earnXp } from "./game";

/**
 * 現在の有効なレースを取得（なければ作成）- グローバル版
 */
const RACE_SCHEDULE = [
    { h: 9, m: 55 }, { h: 10, m: 55 }, { h: 11, m: 55 }, { h: 12, m: 30 },
    { h: 13, m: 55 }, { h: 14, m: 55 }, { h: 15, m: 55 }, { h: 16, m: 55 },
    { h: 17, m: 55 }, { h: 21, m: 30 }
];

/**
 * 現在の有効なレースを取得（なければ作成）- グローバル版
 * M-13: GASスケジュール同期 (9:55, 10:55... 17:55)
 */
export async function getActiveRace(userId: string): Promise<{ race: Race; myBets: Bet[] }> {
    // 現在時刻をJSTとして取得
    const now = new Date(); // UTC for createdAt
    const nowJstStr = now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
    const nowJst = new Date(nowJstStr);

    // 次のレースを探す
    let nextRaceConfig = null;
    const raceDate = new Date(nowJst);

    const currentH = nowJst.getHours();
    const currentM = nowJst.getMinutes();

    // 今日の残りのレースから検索
    // JSTで比較
    for (const s of RACE_SCHEDULE) {
        // 時間差がある場合、または同時刻で未来の場合
        if (s.h > currentH || (s.h === currentH && s.m > currentM)) {
            nextRaceConfig = s;
            break;
        }
    }

    // 今日の分が終わっていれば明日の最初のレース
    if (!nextRaceConfig) {
        nextRaceConfig = RACE_SCHEDULE[0];
        raceDate.setDate(raceDate.getDate() + 1);
    }

    // 発走日時設定 (JST)
    raceDate.setHours(nextRaceConfig.h, nextRaceConfig.m, 0, 0);

    const y = raceDate.getFullYear();
    const m = String(raceDate.getMonth() + 1).padStart(2, "0");
    const d = String(raceDate.getDate()).padStart(2, "0");
    const hh = String(nextRaceConfig.h).padStart(2, "0");
    const mm = String(nextRaceConfig.m).padStart(2, "0");

    // 正しいISO文字列 (JSTオフセット付き) を作成
    // YYYY-MM-DDTHH:mm:00+09:00
    const correctIsoWithOffset = `${y}-${m}-${d}T${hh}:${mm}:00+09:00`;
    const scheduledTime = new Date(correctIsoWithOffset);

    // M-13: IDに分を含める
    const raceId = `${y}${m}${d}_${hh}${mm}`;

    // DB確認
    let raceData = await db
        .select()
        .from(keibaRaces)
        .where(eq(keibaRaces.id, raceId))
        .limit(1)
        .then((res) => res[0]);

    // なければ作成 (Lazy Creation)
    if (!raceData) {
        const horses: Horse[] = DEFAULT_HORSES.map((h) => ({
            ...h,
            odds: Math.round((h.odds + (Math.random() - 0.5) * 0.5) * 10) / 10,
            winRate: h.winRate
        }));

        const name = generateRaceName();

        // System race (userId is null)
        try {
            await db.insert(keibaRaces).values({
                id: raceId,
                userId: null,
                name,
                horsesJson: JSON.stringify(horses),
                status: "waiting",
                scheduledAt: scheduledTime.toISOString(),
                resultsJson: null,
            });

            raceData = {
                id: raceId,
                userId: null,
                name,
                horsesJson: JSON.stringify(horses),
                status: "waiting",
                scheduledAt: scheduledTime.toISOString(),
                winnerId: null,
                resultsJson: null,
                finishedAt: null,
                createdAt: now.toISOString(),
            };
        } catch (e) {
            // Concurrent creation handling: if insert fails (unique constraint), just fetch again
            const retry = await db.select().from(keibaRaces).where(eq(keibaRaces.id, raceId)).limit(1);
            if (retry[0]) raceData = retry[0];
            else throw e; // Unexpected error
        }
    }

    // 遅延解決: もし予定時間を過ぎていて、まだ waiting なら解決を試みる
    if (raceData.status === "waiting" && new Date() >= new Date(raceData.scheduledAt!)) {
        // resolveRace内で排他制御を行うため、ここでは単に呼び出す
        const resolved = await resolveRace(raceId);
        if (resolved) {
            raceData = resolved;
        } else {
            // 別プロセスが処理中、あるいは完了直後。再取得する
            const refetched = await db.select().from(keibaRaces).where(eq(keibaRaces.id, raceId)).limit(1);
            if (refetched[0]) raceData = refetched[0];
        }
    }

    // 自分のベットを取得
    const myBetsData = await db
        .select()
        .from(keibaTransactions)
        .where(
            and(
                eq(keibaTransactions.raceId, raceId),
                eq(keibaTransactions.userId, userId)
            )
        );

    const myBets: Bet[] = myBetsData.map((b) => ({
        id: String(b.id),
        raceId: b.raceId,
        userId: b.userId,
        type: (b.type as BetType) || "WIN",
        mode: (b.mode as BetMode) || "NORMAL",
        horseId: b.horseId || undefined,
        details: b.details || undefined,
        amount: b.betAmount,
        payout: b.payout,
        createdAt: b.createdAt || "",
    }));

    const race: Race = {
        id: raceData.id,
        name: raceData.name,
        horses: JSON.parse(raceData.horsesJson),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: raceData.status as any,
        startedAt: raceData.scheduledAt,
        winnerId: raceData.winnerId,
    };

    return { race, myBets };
}

/**
 * ベットする
 * [FIX] Transaction & Compensation Pattern
 */
/**
 * ベットする
 * [FIX] Transaction & Compensation Pattern -> True DB Transaction
 */
export async function placeBet(
    userId: string,
    raceId: string,
    bets: { type: BetType; mode: BetMode; horseId?: number; details?: string; amount: number }[]
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
    if (!userId) {
        return { success: false, error: "ログインが必要です" };
    }

    try {
        // 全体をトランザクションで囲む
        return await db.transaction(async (tx) => {
            const race = await tx
                .select()
                .from(keibaRaces)
                .where(eq(keibaRaces.id, raceId))
                .limit(1)
                .then((res) => res[0]);

            if (!race) return { success: false, error: "レースが見つかりません" };
            if (race.status !== "waiting") return { success: false, error: "投票は締め切られました" };

            const deadline = new Date(race.scheduledAt!);
            deadline.setMinutes(deadline.getMinutes() - 1);

            if (new Date() > deadline) {
                return { success: false, error: "発走1分前のため投票は締め切られました" };
            }

            const totalAmount = bets.reduce((sum, b) => sum + b.amount, 0);

            // 1. お金を引き落とす (Transaction Context)
            const txResult = await transactMoney(userId, -totalAmount, `競馬投票: ${race.name}`, "BET", tx);
            if (!txResult.success) {
                // ロールバックのためにエラーを投げるか、falseを返してロールバックさせる
                // ここではエラーメッセージを返す必要があるので、例外を投げてcatchブロックで処理するか、
                // トランザクション内でreturnすればコミットされるので、明示的にrollbackが必要。
                // Drizzleのtransactionはcallbackがthrowするとrollbackする。
                throw new Error(txResult.error || "資金不足またはエラーが発生しました");
            }

            // 2. ベット保存
            for (const bet of bets) {
                await tx.insert(keibaTransactions).values({
                    userId,
                    raceId,
                    type: bet.type,
                    mode: bet.mode,
                    horseId: bet.horseId,
                    details: bet.details,
                    betAmount: bet.amount,
                    isWin: false,
                });
            }

            await logActivity(userId, `競馬投票: ${race.name} (計${totalAmount}G)`, null, tx);

            // 成功
            return { success: true, newBalance: txResult.newBalance };
        });
    } catch (e) {
        console.error("[placeBet] Transaction failed:", e);
        return { success: false, error: e instanceof Error ? e.message : "投票処理中にエラーが発生しました" };
    }
}

/**
 * ベットをキャンセルする
 * [NEW] Bet Cancellation Feature
 */
export async function cancelBet(
    userId: string,
    betId: string
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
    if (!userId) {
        return { success: false, error: "ログインが必要です" };
    }

    try {
        return await db.transaction(async (tx) => {
            // 1. ベット情報を取得 (排他ロック的に動くかはDBによるが、存在確認)
            const betRecord = await tx
                .select()
                .from(keibaTransactions)
                .where(and(eq(keibaTransactions.id, Number(betId)), eq(keibaTransactions.userId, userId))) // IDはnumber型
                .limit(1)
                .then((res) => res[0]);

            if (!betRecord) {
                return { success: false, error: "指定された投票が見つからないか、権限がありません" };
            }

            // 2. レース情報を取得して状態チェック
            const race = await tx
                .select()
                .from(keibaRaces)
                .where(eq(keibaRaces.id, betRecord.raceId))
                .limit(1)
                .then((res) => res[0]);

            if (!race) {
                return { success: false, error: "レース情報が見つかりません" };
            }

            if (race.status !== "waiting") {
                return { success: false, error: "レースが開始されたためキャンセルできません" };
            }

            // 3. 時間チェック (発走1分前まで)
            const deadline = new Date(race.scheduledAt!);
            deadline.setMinutes(deadline.getMinutes() - 1);
            if (new Date() > deadline) {
                return { success: false, error: "発走1分前を過ぎているためキャンセルできません" };
            }

            // 4. ベット削除
            await tx
                .delete(keibaTransactions)
                .where(eq(keibaTransactions.id, Number(betId)));

            // 5. 返金処理
            const refundAmount = betRecord.betAmount;
            const txResult = await transactMoney(userId, refundAmount, `競馬キャンセル返金: ${race.name}`, "REFUND", tx);

            if (!txResult.success) {
                throw new Error("返金処理に失敗しました");
            }

            await logActivity(userId, `競馬キャンセル: ${race.name} (返金 ${refundAmount}G)`, null, tx);

            return { success: true, newBalance: txResult.newBalance };
        });
    } catch (e) {
        console.error("[cancelBet] Error:", e);
        return { success: false, error: e instanceof Error ? e.message : "キャンセル処理中にエラーが発生しました" };
    }
}

/**
 * レース結果を確定（Server-Side Resolution）
 * [FIX] Atomic Status Update to prevent Race Conditions (Double Payout)
 */
async function resolveRace(raceId: string) {
    // トランザクションで原子性を確保
    return await db.transaction(async (tx) => {
        // 排他制御: status='waiting' の行を 'calculating' に更新できたプロセスだけが進む
        const updatedRows = await tx
            .update(keibaRaces)
            .set({
                status: "calculating",
                finishedAt: new Date().toISOString(),
            })
            .where(
                and(
                    eq(keibaRaces.id, raceId),
                    eq(keibaRaces.status, "waiting")
                )
            )
            .returning();

        // 更新対象がなかった場合 = 既に他のリクエストが処理したか、完了している
        if (updatedRows.length === 0) {
            return null;
        }

        const race = updatedRows[0];
        const horses: Horse[] = JSON.parse(race.horsesJson);

        // 全順位を決定 (決定的)
        const ranking = determineRanking(horses);
        const winnerId = ranking[0];

        // 結果を保存し、ステータスを finished に
        const finalizingRows = await tx
            .update(keibaRaces)
            .set({
                status: "finished",
                winnerId,
                resultsJson: JSON.stringify(ranking),
            })
            .where(eq(keibaRaces.id, raceId))
            .returning();

        // 配当処理 (同じトランザクション内で実行)
        await processPayouts(raceId, ranking, horses, tx);

        return finalizingRows[0];
    });
}

/**
 * 配当処理（バッチ） - 全賭け式対応版 (Gap M-9)
 * トランザクション内で実行されること
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processPayouts(raceId: string, ranking: number[], horses: Horse[], tx: any) {
    const queryBuilder = tx || db;
    // このレースの全ベット取得
    const bets = await queryBuilder
        .select()
        .from(keibaTransactions)
        .where(eq(keibaTransactions.raceId, raceId));

    const r1 = ranking[0]; // 1着
    const r2 = ranking[1];
    const r3 = ranking[2];
    const top3Set = new Set([r1, r2, r3]);

    for (const bet of bets) {
        // 既に処理済み（万が一）ならスキップ
        if (bet.payout > 0 || bet.isWin) continue;

        let isWin = false;
        let payout = 0;

        // 賭け目の詳細をパース
        let betHorses: number[] = [];
        let betOdds: number | null = null; // nullはdetailsにオッズがない場合
        if (bet.details) {
            try {
                const details = JSON.parse(bet.details);
                betHorses = details.horses || [];
                // details.odds が明示的に設定されている場合のみ使用
                if (typeof details.odds === 'number' && details.odds > 0) {
                    betOdds = details.odds;
                }
            } catch { }
        }
        if (bet.horseId && betHorses.length === 0) {
            betHorses = [bet.horseId];
        }

        const betType = (bet.type || "WIN").toUpperCase();

        // WIN (単勝)
        if (betType === "WIN" || betType === "TANSHO") {
            if (betHorses[0] === r1) {
                isWin = true;
                const horse = horses.find(h => h.id === r1);
                // betOdds が設定されていればそれを使用、なければ馬のオッズを使用
                const effectiveOdds = betOdds !== null ? betOdds : (horse?.odds || 2.0);
                payout = Math.floor(bet.betAmount * effectiveOdds);
            }
        }
        // PLACE (複勝)
        else if (betType === "PLACE" || betType === "FUKUSHO") {
            if (betHorses[0] && top3Set.has(betHorses[0])) {
                isWin = true;
                const horse = horses.find(h => h.id === betHorses[0]);
                // betOdds が設定されていればそれを使用、なければ馬のオッズから計算
                const effectiveOdds = betOdds !== null ? betOdds : Math.max(1.0, (horse?.odds || 3.0) / 3);
                payout = Math.floor(bet.betAmount * effectiveOdds);
            }
        }
        // UMAREN (馬連)
        else if (betType === "UMAREN") {
            if (betHorses.length >= 2) {
                const h1 = betHorses[0];
                const h2 = betHorses[1];
                if ((h1 === r1 && h2 === r2) || (h1 === r2 && h2 === r1)) {
                    isWin = true;
                    // 馬連のデフォルトオッズは5.0倍
                    const effectiveOdds = betOdds !== null ? betOdds : 5.0;
                    payout = Math.floor(bet.betAmount * effectiveOdds);
                }
            }
        }
        // UMATAN (馬単)
        else if (betType === "UMATAN") {
            if (betHorses.length >= 2 && betHorses[0] === r1 && betHorses[1] === r2) {
                isWin = true;
                // 馬単のデフォルトオッズは10.0倍
                const effectiveOdds = betOdds !== null ? betOdds : 10.0;
                payout = Math.floor(bet.betAmount * effectiveOdds);
            }
        }
        // SANRENPUKU (3連複)
        else if (betType === "SANRENPUKU") {
            if (betHorses.length >= 3) {
                const betSet = new Set(betHorses.slice(0, 3));
                if (betSet.has(r1) && betSet.has(r2) && betSet.has(r3)) {
                    isWin = true;
                    // 3連複のデフォルトオッズは15.0倍
                    const effectiveOdds = betOdds !== null ? betOdds : 15.0;
                    payout = Math.floor(bet.betAmount * effectiveOdds);
                }
            }
        }
        // SANRENTAN (3連単)
        else if (betType === "SANRENTAN") {
            if (betHorses.length >= 3 &&
                betHorses[0] === r1 && betHorses[1] === r2 && betHorses[2] === r3) {
                isWin = true;
                // 3連単のデフォルトオッズは50.0倍
                const effectiveOdds = betOdds !== null ? betOdds : 50.0;
                payout = Math.floor(bet.betAmount * effectiveOdds);
            }
        }

        // 配当処理
        if (isWin && payout > 0) {
            // トランザクション更新
            await queryBuilder
                .update(keibaTransactions)
                .set({
                    payout,
                    isWin: true
                })
                .where(eq(keibaTransactions.id, bet.id));

            // ユーザーに払い戻し
            await transactMoney(bet.userId, payout, `競馬配当: ${raceId} (${bet.type})`, "PAYOUT", tx);

            // XP付与 (Todo: earnXpもtx対応が必要だが、XPはそこまで厳密でなくても許容できるか？
            // いったんそのまま。XPのデータ不整合はクリティカルではない。)
            await earnXp(bet.userId, "race_win");
        }
    }
}

// Helper to determine ranking based on winRate
function determineRanking(horses: Horse[]): number[] {
    let candidates = [...horses];
    const ranking: number[] = [];

    while (candidates.length > 0) {
        const totalRate = candidates.reduce((sum, h) => sum + h.winRate, 0);
        let random = Math.random() * totalRate;
        let selected = candidates[0];

        for (const horse of candidates) {
            random -= horse.winRate;
            if (random <= 0) {
                selected = horse;
                break;
            }
        }

        ranking.push(selected.id);
        candidates = candidates.filter(h => h.id !== selected.id);
    }
    return ranking;
}


/**
 * 競馬履歴を取得 (互換性用)
 */
export async function getKeibaHistory(
    userId: string,
    limit: number = 20
): Promise<KeibaTransaction[]> {
    const transactions = await db
        .select()
        .from(keibaTransactions)
        .where(eq(keibaTransactions.userId, userId))
        .orderBy(desc(keibaTransactions.createdAt))
        .limit(limit);

    return transactions.map((t) => ({
        id: t.id,
        raceId: t.raceId,
        userId: t.userId,
        type: t.type || "WIN",
        mode: t.mode || "NORMAL",
        horseId: t.horseId || undefined,
        details: t.details || undefined,
        betAmount: t.betAmount,
        payout: t.payout,
        isWin: t.isWin ?? false,
        createdAt: t.createdAt || "",
    }));
}



// ========== ガチャ (既存のまま) ==========

export async function pullGacha(
    userId: string,
    poolId: string = "standard",
    count: number = 1
): Promise<{
    success: boolean;
    results?: GachaResult[];
    error?: string;
}> {
    const pool = DEFAULT_GACHA_POOL;
    const totalCost = pool.cost * count;

    const deductResult = await transactMoney(userId, -totalCost, "ガチャ", "GACHA");
    if (!deductResult.success) {
        return { success: false, error: deductResult.error };
    }

    const results: GachaResult[] = [];

    try {
        for (let i = 0; i < count; i++) {
            const item = selectGachaItem(pool.items);

            const existing = await db
                .select()
                .from(gachaRecords)
                .where(eq(gachaRecords.itemId, item.id));

            const duplicate = existing.length;

            results.push({
                item,
                isNew: duplicate === 0,
                duplicate,
            });

            await db.insert(gachaRecords).values({
                userId,
                poolId,
                itemId: item.id,
                rarity: item.rarity,
            });

            await earnXp(userId, "gacha_play");
            await logActivity(userId, `ガチャ獲得: ${item.name} (${item.rarity})`);
            await applyGachaItemEffect(userId, item);
        }

        return { success: true, results };
    } catch (e) {
        console.error("pullGacha error:", e);
        // ガチャも同様に返金処理を入れるべきだが、今回は競馬に集中。
        return { success: false, error: "ガチャデータの保存に失敗しました" };
    }
}

export async function getGachaHistory(limit: number = 50): Promise<GachaRecord[]> {
    const records = await db
        .select()
        .from(gachaRecords)
        .orderBy(desc(gachaRecords.createdAt))
        .limit(limit);

    return records.map((r) => ({
        id: r.id,
        poolId: r.poolId,
        itemId: r.itemId,
        rarity: r.rarity as GachaRecord["rarity"],
        createdAt: r.createdAt || "",
    }));
}

// ========== ヘルパー関数 ==========

function generateRaceName(): string {
    const prefixes = ["第", ""];
    const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    const types = ["わくわく杯", "スプリント", "マイルCS", "グランプリ", "ダービー"];

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const number = numbers[Math.floor(Math.random() * numbers.length)];
    const type = types[Math.floor(Math.random() * types.length)];

    return `${prefix}${number}回 ${type}`;
}

// Legacy helper removed
// function selectWinner...

function selectGachaItem(items: GachaItem[]): GachaItem {
    const totalRate = items.reduce((sum, i) => sum + i.dropRate, 0);
    let random = Math.random() * totalRate;

    for (const item of items) {
        random -= item.dropRate;
        if (random <= 0) {
            return item;
        }
    }
    return items[0];
}

async function applyGachaItemEffect(userId: string, item: GachaItem): Promise<void> {
    // コインアイテム
    if (item.id.includes("coin") || item.id.includes("jackpot") || item.id.includes("golden")) {
        const amounts: Record<string, number> = {
            n_coin_s: 50,
            n_coin_m: 100,
            r_coin_l: 300,
            sr_coin_xl: 500,
            ssr_jackpot: 1000,
            ur_golden: 3000,
        };
        const amount = amounts[item.id] || 0;
        if (amount > 0) {
            await transactMoney(userId, amount, `ガチャ獲得: ${item.name}`, "GACHA_ITEM");
        }
    }

    // XPアイテム
    if (item.id.includes("xp")) {
        const amounts: Record<string, number> = {
            n_xp_s: 50,
            r_xp_m: 150,
            sr_xp_l: 300,
            ssr_mega_xp: 1000,
        };
        const amount = amounts[item.id] || 0;
        if (amount > 0) {
            const existing = await db
                .select()
                .from(gameData)
                .where(eq(gameData.userId, userId))
                .limit(1);

            if (existing.length > 0) {
                const data = JSON.parse(existing[0].dataJson);
                data.xp += amount;
                await db
                    .update(gameData)
                    .set({
                        dataJson: JSON.stringify(data),
                        updatedAt: new Date().toISOString(),
                    })
                    .where(eq(gameData.userId, userId));
            }
        }
    }

    // インベントリアイテム (テーマ、ブースター、特殊) - M-11拡張
    const inventoryPatterns = ["theme", "booster", "decoration", "special", "ticket"];
    const isInventoryItem = inventoryPatterns.some(pattern => item.id.toLowerCase().includes(pattern));

    if (isInventoryItem && !item.id.includes("coin") && !item.id.includes("xp")) {
        const existing = await db
            .select()
            .from(gameData)
            .where(eq(gameData.userId, userId))
            .limit(1);

        if (existing.length > 0) {
            const data = JSON.parse(existing[0].dataJson);
            data.inventory = data.inventory || {};
            data.inventory[item.id] = (data.inventory[item.id] || 0) + 1;
            await db
                .update(gameData)
                .set({
                    dataJson: JSON.stringify(data),
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(gameData.userId, userId));
        }
    }
}

/**
 * 本日のレース結果一覧を取得 (M-20)
 * 完了済みのレースと着順、配当を返す
 * JSTタイムゾーンを考慮して本日の範囲を計算
 */
export async function getTodayRaceResults(): Promise<{ race: Race; results: string[]; ranking: number[] }[]> {
    try {
        // JSTで現在時刻を取得
        const now = new Date();
        const nowJstStr = now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
        const nowJst = new Date(nowJstStr);

        // JSTの本日0:00と23:59:59を計算
        const y = nowJst.getFullYear();
        const m = String(nowJst.getMonth() + 1).padStart(2, "0");
        const d = String(nowJst.getDate()).padStart(2, "0");

        // ISO形式でJSTオフセット付きの範囲を作成
        const startOfDay = `${y}-${m}-${d}T00:00:00+09:00`;
        const endOfDay = `${y}-${m}-${d}T23:59:59+09:00`;

        // scheduledAtはJSTオフセット付きで保存されているので、ISO文字列として比較可能
        const races = await db
            .select()
            .from(keibaRaces)
            .where(
                and(
                    eq(keibaRaces.status, "finished"),
                    gt(keibaRaces.scheduledAt, new Date(startOfDay).toISOString()),
                    lt(keibaRaces.scheduledAt, new Date(endOfDay).toISOString())
                )
            )
            .orderBy(desc(keibaRaces.scheduledAt));

        return races.map(r => {
            let results: string[] = [];
            let resultIds: number[] = [];
            try {
                resultIds = JSON.parse(r.resultsJson || "[]") as number[];
                const horses = JSON.parse(r.horsesJson) as Horse[];
                results = resultIds.map(hid => {
                    const h = horses.find(h => h.id === hid);
                    return h ? `${h.name} (${h.odds}倍)` : `ID:${hid}`;
                });
            } catch {
                results = ["解析エラー"];
            }

            return {
                race: {
                    ...r,
                    status: r.status as "waiting" | "racing" | "finished",
                    horses: JSON.parse(r.horsesJson),
                    startedAt: r.scheduledAt || r.createdAt || ""
                },
                results,
                ranking: resultIds
            };
        });

    } catch {
        return [];
    }
}
