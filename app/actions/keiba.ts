"use server";

/**
 * 競馬・ガチャ Server Actions (Global Multiplayer Version)
 * GASのKeiba/Gachaを置き換え
 * - Lazy Creationによるグローバルレース生成
 * - 複雑なベット対応
 */

import { db } from "@/lib/db/client";
import { gameData, keibaRaces, keibaTransactions, gachaRecords } from "@/lib/db/schema";
import { eq, desc, and, sql, lt, gt } from "drizzle-orm";
import { logActivity } from "./log";
import type {
    Race,
    Bet,
    RaceResult,
    Horse,
    GachaResult,
    GachaItem,
    KeibaTransaction,
    GachaRecord,
    BetType,
    BetMode
} from "@/types/keiba";
import { DEFAULT_HORSES, DEFAULT_GACHA_POOL, RARITY_CONFIG } from "@/types/keiba";
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
    let raceDate = new Date(nowJst);

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

    // Dateオブジェクトは内部的にローカル時間を持っているので、
    // これをUTCのISOStringとして保存するとずれる可能性がある。
    // しかし、DBにはISOStringで保存し、アプリ全体で「JSTとして解釈」するか、
    // あるいは「UTCの絶対時刻」として正しい値をセットするか。

    // ここでは「絶対時刻」として正しいUTCに変換して保存するのがベスト。
    // raceDateは現在「JSTの日時と同じ数値を持つローカルDate」になっている（new Date(jstStr)のため）。
    // これを正しいUTCに戻すには、-9時間する必要がある。

    // 例: JST 10:55 -> raceDateは Local 10:55
    // これをUTCにするには、10:55 - 9 = 01:55 UTC にしたい。
    // new Date(raceDate) でISOStringにすると、Local Timezone (Next.js server usually UTC) が適用される。
    // ServerがUTCの場合、Local 10:55 -> ISO "T10:55:00Z" になってしまう（実際はT01:55:00Zであるべき）。

    // 解決策: JST文字列表現から正しいDateオブジェクトを作る
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
            createdAt: now.toISOString(), // 作成日時（現在）
        };
    }

    // 遅延解決: もし予定時間を過ぎていて、まだ waiting なら結果を生成
    if (raceData.status === "waiting" && new Date() >= new Date(raceData.scheduledAt!)) {
        raceData = await resolveRace(raceId);
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
        status: raceData.status as any,
        startedAt: raceData.scheduledAt,
        winnerId: raceData.winnerId,
    };

    return { race, myBets };
}

/**
 * ベットする
 */
export async function placeBet(
    userId: string,
    raceId: string,
    bets: { type: BetType; mode: BetMode; horseId?: number; details?: string; amount: number }[]
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
    if (!userId) {
        return { success: false, error: "ログインが必要です" };
    }

    // レース状態確認
    const race = await db
        .select()
        .from(keibaRaces)
        .where(eq(keibaRaces.id, raceId))
        .limit(1)
        .then((res) => res[0]);

    if (!race) return { success: false, error: "レースが見つかりません" };
    if (race.status !== "waiting") return { success: false, error: "投票は締め切られました" };

    // 締切時刻チェック (発走1分前まで)
    const deadline = new Date(race.scheduledAt!);
    deadline.setMinutes(deadline.getMinutes() - 1);
    if (new Date() > deadline) {
        return { success: false, error: "発走1分前のため投票は締め切られました" };
    }

    // 合計金額計算
    const totalAmount = bets.reduce((sum, b) => sum + b.amount, 0);

    // 所持金チェック & 引き落とし
    const tx = await transactMoney(userId, -totalAmount, `競馬投票: ${race.name}`, "BET");
    if (!tx.success) return { success: false, error: tx.error };

    try {
        // ベット保存
        for (const bet of bets) {
            await db.insert(keibaTransactions).values({
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

        // M-16: ログ記録
        await logActivity(userId, `競馬投票: ${race.name} (計${totalAmount}G)`);

        return { success: true, newBalance: tx.newBalance };
    } catch (e) {
        console.error("placeBet error:", e);
        // 返金処理が必要かもしれないが、今はエラー表示のみ
        // 本来はトランザクションを使うべき箇所
        return { success: false, error: "投票データの保存に失敗しました" };
    }
}

/**
 * レース結果を確定（Server-Side Resolution）
 */
async function resolveRace(raceId: string) {
    const race = await db
        .select()
        .from(keibaRaces)
        .where(eq(keibaRaces.id, raceId))
        .limit(1)
        .then((res) => res[0]);

    if (!race || race.status !== "waiting") return race!;

    const horses: Horse[] = JSON.parse(race.horsesJson);

    // 全順位を決定
    const ranking = determineRanking(horses);
    const winnerId = ranking[0];

    // DB更新
    await db
        .update(keibaRaces)
        .set({
            status: "finished",
            winnerId,
            resultsJson: JSON.stringify(ranking),
            finishedAt: new Date().toISOString(),
        })
        .where(eq(keibaRaces.id, raceId));

    // 結果が確定したので、このレースに対する全ユーザーの配当を処理
    await processPayouts(raceId, ranking, horses);

    return { ...race, status: "finished", winnerId, resultsJson: JSON.stringify(ranking), finishedAt: new Date().toISOString() };
}

/**
 * 配当処理（バッチ） - 全賭け式対応版 (Gap M-9)
 */
async function processPayouts(raceId: string, ranking: number[], horses: Horse[]) {
    // このレースの全ベット取得
    const bets = await db
        .select()
        .from(keibaTransactions)
        .where(eq(keibaTransactions.raceId, raceId));

    const r1 = ranking[0]; // 1着
    const r2 = ranking[1]; // 2着
    const r3 = ranking[2]; // 3着
    const top3Set = new Set([r1, r2, r3]);

    for (const bet of bets) {
        let isWin = false;
        let payout = 0;

        // 賭け目の詳細をパース (複雑なベットの場合)
        let betHorses: number[] = [];
        let betOdds = 1.0;
        if (bet.details) {
            try {
                const details = JSON.parse(bet.details);
                betHorses = details.horses || [];
                betOdds = details.odds || 1.0;
            } catch {
                // detailsパース失敗時はhorseId使用
            }
        }
        // horseIdが設定されている場合はそれを使用 (WIN/PLACE等)
        if (bet.horseId && betHorses.length === 0) {
            betHorses = [bet.horseId];
        }

        const betType = (bet.type || "WIN").toUpperCase();

        // WIN (単勝)
        if (betType === "WIN" || betType === "TANSHO") {
            if (betHorses[0] === r1) {
                isWin = true;
                const horse = horses.find(h => h.id === r1);
                payout = Math.floor(bet.betAmount * (betOdds > 1 ? betOdds : horse?.odds || 2.0));
            }
        }
        // PLACE (複勝) - 3着以内
        else if (betType === "PLACE" || betType === "FUKUSHO") {
            if (betHorses[0] && top3Set.has(betHorses[0])) {
                isWin = true;
                const horse = horses.find(h => h.id === betHorses[0]);
                const odds = betOdds > 1 ? betOdds : (horse ? Math.max(1.0, horse.odds / 3) : 1.3);
                payout = Math.floor(bet.betAmount * odds);
            }
        }
        // UMAREN (馬連) - 1,2着 順不同
        else if (betType === "UMAREN") {
            if (betHorses.length >= 2) {
                const h1 = betHorses[0];
                const h2 = betHorses[1];
                if ((h1 === r1 && h2 === r2) || (h1 === r2 && h2 === r1)) {
                    isWin = true;
                    payout = Math.floor(bet.betAmount * betOdds);
                }
            }
        }
        // UMATAN (馬単) - 1着→2着 順序通り
        else if (betType === "UMATAN") {
            if (betHorses.length >= 2 && betHorses[0] === r1 && betHorses[1] === r2) {
                isWin = true;
                payout = Math.floor(bet.betAmount * betOdds);
            }
        }
        // SANRENPUKU (3連複) - 1,2,3着 順不同
        else if (betType === "SANRENPUKU") {
            if (betHorses.length >= 3) {
                const betSet = new Set(betHorses.slice(0, 3));
                if (betSet.has(r1) && betSet.has(r2) && betSet.has(r3)) {
                    isWin = true;
                    payout = Math.floor(bet.betAmount * betOdds);
                }
            }
        }
        // SANRENTAN (3連単) - 1着→2着→3着 順序通り
        else if (betType === "SANRENTAN") {
            if (betHorses.length >= 3 &&
                betHorses[0] === r1 && betHorses[1] === r2 && betHorses[2] === r3) {
                isWin = true;
                payout = Math.floor(bet.betAmount * betOdds);
            }
        }

        // 配当処理
        if (isWin && payout > 0) {
            // トランザクション更新
            await db
                .update(keibaTransactions)
                .set({
                    payout,
                    isWin: true
                })
                .where(eq(keibaTransactions.id, bet.id));

            // ユーザーに払い戻し
            await transactMoney(bet.userId, payout, `競馬配当: ${raceId} (${bet.type})`, "PAYOUT");

            // XP付与
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
    // ユーザーの全トランザクションを取得
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

    // 費用を差し引く
    const deductResult = await transactMoney(userId, -totalCost, "ガチャ", "GACHA");
    if (!deductResult.success) {
        return { success: false, error: deductResult.error };
    }

    // ガチャを実行
    const results: GachaResult[] = [];

    try {
        for (let i = 0; i < count; i++) {
            const item = selectGachaItem(pool.items);

            // 既存の記録を確認
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

            // 記録を保存 (M-11: userId追加)
            await db.insert(gachaRecords).values({
                userId,
                poolId,
                itemId: item.id,
                rarity: item.rarity,
            });

            // XP獲得
            await earnXp(userId, "gacha_play");

            // M-16: ログ記録
            await logActivity(userId, `ガチャ獲得: ${item.name} (${item.rarity})`);

            // アイテム効果を適用
            await applyGachaItemEffect(userId, item);
        }

        return { success: true, results };
    } catch (e) {
        console.error("pullGacha error:", e);
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

// Legacy helper kept just in case, but determineRanking is preferred
function selectWinner(horses: Horse[]): number {
    const totalRate = horses.reduce((sum, h) => sum + h.winRate, 0);
    let random = Math.random() * totalRate;

    for (const horse of horses) {
        random -= horse.winRate;
        if (random <= 0) {
            return horse.id;
        }
    }

    return horses[0].id;
}

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
 */
export async function getTodayRaceResults(): Promise<{ race: Race; results: string[]; ranking: number[] }[]> {
    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

        const races = await db
            .select()
            .from(keibaRaces)
            .where(
                and(
                    eq(keibaRaces.status, "finished"),
                    gt(keibaRaces.scheduledAt, startOfDay),
                    lt(keibaRaces.scheduledAt, endOfDay)
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
            } catch (e) {
                results = ["解析エラー"];
            }

            return {
                race: {
                    ...r,
                    status: r.status as "waiting" | "racing" | "finished",
                    horses: JSON.parse(r.horsesJson),
                    startedAt: r.scheduledAt || r.createdAt || "" // Map to Race.startedAt (ensure string)
                },
                results,
                ranking: resultIds // Add ranking (M-20 fix for RaceResultsPanel)
            };
        });

    } catch (e) {
        console.error("getTodayRaceResults error:", e);
        return [];
    }
}
