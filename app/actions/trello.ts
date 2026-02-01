"use server";

/**
 * Trello Server Actions
 * GASの getTrelloData, moveCardTrello 等を置き換え
 */

import {
    getBoardLists,
    getBoardCards,
    getBoardCustomFields,
    moveCard as trelloMoveCard,
    updateCardDue as trelloUpdateDue,
    updateCardDescription as trelloUpdateDesc,
    postCardComment,
    deleteComment,
    TrelloCard,
    TrelloCustomField,
} from "@/lib/trello/client";
import { db } from "@/lib/db/client";
import { assignments, activityLogs, memos } from "@/lib/db/schema";
import { eq, and, lt, isNull, or } from "drizzle-orm";
import { logActivity } from "./log";
import type {
    BoardData,
    TrelloDataResponse,
    ProcessedCard,
    CardRoles,
    MemberLists,
    FilterOptions,
} from "@/types/trello";

const BOARD_ID = process.env.TRELLO_BOARD_ID!;
const CONSTRUCTION_FIELD_ID = process.env.TRELLO_CONSTRUCTION_FIELD_ID;

/**
 * ボードデータを取得（GASの getTrelloData を置き換え）
 */
export async function getTrelloData(): Promise<TrelloDataResponse> {
    try {
        // 並行してデータ取得
        const [lists, cards, customFields, assignmentData, memberData, overdueMemos] =
            await Promise.all([
                getBoardLists(BOARD_ID),
                getBoardCards(BOARD_ID),
                getBoardCustomFields(BOARD_ID),
                db.select().from(assignments),
                getMembers(),
                getOverdueMemoCardIds(),
            ]);

        // 「構築No.」フィールドの定義を探す
        const constructionFieldDef = customFields.find(
            (f: TrelloCustomField) => f.name === "構築No."
        );
        const constructionFieldId = constructionFieldDef?.id || CONSTRUCTION_FIELD_ID;
        const constructionFieldOptions = constructionFieldDef?.options || [];

        // 担当者マップを作成
        const assignmentMap = new Map<string, CardRoles>();
        for (const row of assignmentData) {
            assignmentMap.set(row.cardId, {
                construction: row.construction || "",
                system: row.system || "",
                sales: row.sales || "",
                mtg: row.mtg || "",
                systemType: row.systemType || "",
                systemType2: row.systemType2 || "",
                customLink: row.customLink || "",
                constructionNumber: row.constructionNumber || "",
                memo1: row.memo1 || "",
                memo2: row.memo2 || "",
                memo3: row.memo3 || "",
                isPinned: row.isPinned || false,
                updatedAt: row.updatedAt || "",
            });
        }

        // フィルターオプション用のSet
        const industrySet = new Set<string>();
        const prefectureSet = new Set<string>();
        const trelloLabelSet = new Set<string>();
        const rolesSet = {
            construction: new Set<string>(),
            system: new Set<string>(),
            sales: new Set<string>(),
            mtg: new Set<string>(),
        };
        const systemTypeSet = new Set<string>();

        // カードを処理
        const processedCards: ProcessedCard[] = cards.map((card: TrelloCard) => {
            const attributes = { industries: [] as string[], prefectures: [] as string[] };

            // チェックリストから業種・都道府県を抽出
            if (card.checklists) {
                for (const checklist of card.checklists) {
                    if (checklist.name === "業種") {
                        for (const item of checklist.checkItems) {
                            if (item.state === "complete") {
                                attributes.industries.push(item.name);
                                industrySet.add(item.name);
                            }
                        }
                    } else if (checklist.name === "都道府県") {
                        for (const item of checklist.checkItems) {
                            if (item.state === "complete") {
                                attributes.prefectures.push(item.name);
                                prefectureSet.add(item.name);
                            }
                        }
                    }
                }
            }

            // ラベル処理
            const processedLabels = (card.labels || []).map((label) => {
                if (label.name) trelloLabelSet.add(label.name);
                return { name: label.name || "", color: label.color };
            });

            // カードID（shortLink優先）
            let safeId = card.shortLink || card.id;
            safeId = safeId.trim();

            // 担当者データ取得
            const roleData = assignmentMap.get(safeId) || {
                construction: "",
                system: "",
                sales: "",
                mtg: "",
                systemType: "",
                systemType2: "",
                customLink: "",
                constructionNumber: "",
                memo1: "",
                memo2: "",
                memo3: "",
                isPinned: false,
                updatedAt: "",
            };

            // Trelloカスタムフィールドから構築No.を取得
            if (constructionFieldId && card.customFieldItems) {
                const targetItem = card.customFieldItems.find(
                    (item) => item.idCustomField === constructionFieldId
                );

                if (targetItem) {
                    let trelloVal = "";

                    // リスト形式
                    if (targetItem.idValue) {
                        const selectedOption = constructionFieldOptions.find(
                            (opt) => opt.id === targetItem.idValue
                        );
                        if (selectedOption?.value) {
                            trelloVal = selectedOption.value.text;
                        }
                    }
                    // 数値・テキスト形式
                    else if (targetItem.value) {
                        if (targetItem.value.number !== undefined) {
                            trelloVal = String(targetItem.value.number);
                        } else if (targetItem.value.text !== undefined) {
                            trelloVal = String(targetItem.value.text);
                        }
                    }

                    if (trelloVal) {
                        roleData.constructionNumber = trelloVal;
                    }
                }
            }

            // フィルター用のSet更新
            if (roleData.construction) rolesSet.construction.add(roleData.construction);
            if (roleData.system) rolesSet.system.add(roleData.system);
            if (roleData.sales) rolesSet.sales.add(roleData.sales);
            if (roleData.mtg) rolesSet.mtg.add(roleData.mtg);
            if (roleData.systemType) systemTypeSet.add(roleData.systemType);
            if (roleData.systemType2) systemTypeSet.add(roleData.systemType2);

            return {
                id: safeId,
                realId: card.id,
                name: card.name,
                idList: card.idList,
                url: card.shortUrl,
                due: card.due,
                dueComplete: card.dueComplete,
                industries: attributes.industries,
                prefectures: attributes.prefectures,
                trelloLabels: processedLabels,
                roles: roleData,
                desc: card.desc || "",
            };
        });

        const filterOptions: FilterOptions = {
            industries: Array.from(industrySet).sort(),
            prefectures: Array.from(prefectureSet).sort(),
            trelloLabels: Array.from(trelloLabelSet).sort(),
            roles: {
                construction: Array.from(rolesSet.construction).sort(),
                system: Array.from(rolesSet.system).sort(),
                sales: Array.from(rolesSet.sales).sort(),
                mtg: Array.from(rolesSet.mtg).sort(),
            },
            systemTypes: Array.from(systemTypeSet).sort(),
        };

        const data: BoardData = {
            lists: lists.map((l) => ({ id: l.id, name: l.name })),
            cards: processedCards,
            members: memberData,
            overdueMemoCardIds: overdueMemos,
            filterOptions,
        };

        return { data, error: null };
    } catch (e) {
        console.error("getTrelloData error:", e);
        return {
            data: null,
            error: `データ取得エラー: ${e instanceof Error ? e.message : String(e)}`,
        };
    }
}

/**
 * メンバーリストを取得（ハードコーディング or DB）
 * TODO: DBに保存されたメンバーを取得するように変更
 */
async function getMembers(): Promise<MemberLists> {
    // 初期値（GASからの移行データ）
    return {
        construction: ["未設定"],
        system: ["未設定"],
        sales: ["未設定"],
        mtg: ["未設定"],
    };
}

/**
 * 期限切れメモのカードIDを取得
 */
async function getOverdueMemoCardIds(): Promise<string[]> {
    const now = new Date().toISOString();
    const overdue = await db
        .select({ cardId: memos.cardId })
        .from(memos)
        .where(
            and(
                eq(memos.type, "card"),
                eq(memos.isFinished, false),
                lt(memos.notifyTime, now)
            )
        );

    return overdue
        .filter((m) => m.cardId)
        .map((m) => m.cardId as string);
}

/**
 * カードを移動（GASの moveCardTrello を置き換え）
 */
export async function moveCardToList(
    cardId: string,
    newListId: string,
    userId?: string,
    cardName?: string,
    listName?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await trelloMoveCard(cardId, newListId);

        // ログ記録（引数が渡された場合のみ）
        if (userId && cardName && listName) {
            await logActivity(userId, `移動: ${cardName} -> ${listName}`, cardId);
        }

        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * カード期限を更新
 */
export async function updateCardDue(
    cardId: string,
    dueString: string | null
): Promise<{ success: boolean; error?: string }> {
    try {
        await trelloUpdateDue(cardId, dueString);
        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * 担当者情報を保存
 */
export async function saveCardAssignment(
    cardId: string,
    roles: Partial<CardRoles>
): Promise<{ success: boolean; error?: string }> {
    try {
        const existing = await db
            .select()
            .from(assignments)
            .where(eq(assignments.cardId, cardId))
            .limit(1);

        const now = new Date().toISOString();

        if (existing.length > 0) {
            // 更新
            await db
                .update(assignments)
                .set({
                    construction: roles.construction,
                    system: roles.system,
                    sales: roles.sales,
                    mtg: roles.mtg,
                    systemType: roles.systemType,
                    systemType2: roles.systemType2,
                    customLink: roles.customLink,
                    constructionNumber: roles.constructionNumber,
                    memo1: roles.memo1,
                    memo2: roles.memo2,
                    memo3: roles.memo3,
                    isPinned: roles.isPinned,
                    updatedAt: now,
                })
                .where(eq(assignments.cardId, cardId));
        } else {
            // 新規作成
            await db.insert(assignments).values({
                cardId,
                construction: roles.construction || "",
                system: roles.system || "",
                sales: roles.sales || "",
                mtg: roles.mtg || "",
                systemType: roles.systemType || "",
                systemType2: roles.systemType2 || "",
                customLink: roles.customLink || "",
                constructionNumber: roles.constructionNumber || "",
                memo1: roles.memo1 || "",
                memo2: roles.memo2 || "",
                memo3: roles.memo3 || "",
                isPinned: roles.isPinned || false,
                updatedAt: now,
            });
        }

        // ... assignment DB update/insert logic ...

        /* --- Trello同期処理 (Gap M-5対応) --- */
        // エラーが出てもDB保存はロールバックしない方針（同期失敗ログのみ）
        try {
            // 構築No. または システム種別 が更新対象の場合のみ実行
            if (roles.constructionNumber !== undefined || roles.systemType !== undefined) {
                const boardId = process.env.TRELLO_BOARD_ID;
                const apiKey = process.env.TRELLO_API_KEY;
                const token = process.env.TRELLO_TOKEN;

                if (boardId) {
                    // カスタムフィールド定義を取得してIDを特定する (動的解決)
                    const cfUrl = `https://api.trello.com/1/boards/${boardId}/customFields?key=${apiKey}&token=${token}`;
                    const cfRes = await fetch(cfUrl);
                    if (cfRes.ok) {
                        const customFields = await cfRes.json();

                        // 構築No. (Construction No.)
                        if (roles.constructionNumber !== undefined) {
                            const targetField = customFields.find((f: any) => f.name === "構築No.");
                            if (targetField) {
                                await updateTrelloCustomField(cardId, targetField.id, roles.constructionNumber);
                            }
                        }

                        // システム種別 (System Type)
                        if (roles.systemType !== undefined) {
                            // "システム種別" または "System Type" などを探す (環境に合わせて調整)
                            // GAS版ではカスタムフィールドとして扱っていたため、ここでも対応
                            const targetField = customFields.find((f: any) => f.name === "システム種別" || f.name === "System Type");
                            if (targetField) {
                                await updateTrelloCustomField(cardId, targetField.id, roles.systemType);
                            }
                        }
                    }
                }
            }
        } catch (syncError) {
            console.error("Trello Custom Field Sync Failed:", syncError);
        }

        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * カードログを取得
 */
export async function getCardLogs(
    cardId: string
): Promise<{ date: string; user: string; action: string }[]> {
    const logs = await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.cardId, cardId))
        .orderBy(activityLogs.createdAt);

    return logs.map((log) => ({
        date: log.createdAt || "",
        user: log.userId,
        action: log.action,
    }));
}

/**
 * Trelloにコメントを投稿
 */
export async function addTrelloComment(
    cardId: string,
    text: string
): Promise<{ success: boolean; commentId?: string; error?: string }> {
    try {
        const result = await postCardComment(cardId, text);
        return { success: true, commentId: result.id };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * Trelloコメントを削除
 */
export async function deleteTrelloComment(
    commentId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await deleteComment(commentId);
        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}
/**
 * Trelloカスタムフィールド（リスト形式）を更新
 * GAS版の updateTrelloListCustomField を再現
 */
export async function updateTrelloCustomField(
    cardId: string,
    customFieldId: string,
    valueText: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. 値をクリアする場合
        if (!valueText) {
            await putTrelloCustomField(cardId, customFieldId, { value: "" });
            return { success: true };
        }

        const apiKey = process.env.TRELLO_API_KEY;
        const token = process.env.TRELLO_TOKEN;

        // 2. カスタムフィールドの定義（選択肢）を取得
        const fieldUrl = `https://api.trello.com/1/customFields/${customFieldId}?key=${apiKey}&token=${token}`;
        const fieldRes = await fetch(fieldUrl);
        if (!fieldRes.ok) {
            throw new Error(`Failed to fetch field def: ${fieldRes.statusText}`);
        }
        const fieldData = await fieldRes.json();
        const options = fieldData.options || [];

        // 3. テキストと一致する選択肢を探す
        // TrelloのOptionは { id: "...", value: { text: "..." } } の形式
        const matchedOption = options.find((opt: any) => opt.value?.text == valueText);

        if (!matchedOption) {
            console.warn(`Trello Custom Field Skip: Option "${valueText}" not found for field ${customFieldId}`);
            // オプションが見つからない場合はエラーとせず、スキップする（GAS版も同様）
            return { success: false, error: "Option not found" };
        }

        // 4. 更新リクエスト (idValueを指定)
        await putTrelloCustomField(cardId, customFieldId, { idValue: matchedOption.id });
        return { success: true };

    } catch (e) {
        console.error("updateTrelloCustomField error:", e);
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * Trello APIへのPUTリクエスト (Custom Field Item)
 */
async function putTrelloCustomField(cardId: string, customFieldId: string, payload: any) {
    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;
    const url = `https://api.trello.com/1/cards/${cardId}/customField/${customFieldId}/item?key=${apiKey}&token=${token}`;

    const res = await fetch(url, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Trello API Error: ${errText}`);
    }
    return res.json();
}

/**
 * カード説明文を更新 (Gap M-7対応)
 */
export async function updateTrelloDescription(
    cardId: string,
    description: string,
    userId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await trelloUpdateDesc(cardId, description);

        // ログ記録
        // ログ記録
        if (userId) {
            await logActivity(userId, `説明文更新: ${cardId.substring(0, 8)}...`, cardId);
        }

        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}
