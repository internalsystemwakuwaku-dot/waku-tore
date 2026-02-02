/**
 * Trello API クライアント
 * GASの fetchJson / UrlFetchApp を置き換え
 */

const TRELLO_API_BASE = "https://api.trello.com/1";

// 環境変数からAPI認証情報を取得
function getCredentials() {
    const apiKey = process.env.TRELLO_API_KEY;
    const apiToken = process.env.TRELLO_API_TOKEN;
    if (!apiKey || !apiToken) {
        throw new Error("Trello API credentials not configured");
    }
    return { apiKey, apiToken };
}

/**
 * Trello APIにリクエストを送信する共通関数
 * GASの fetchJson を置き換え（リトライ機能付き）
 */
export async function trelloFetch<T>(
    endpoint: string,
    options: RequestInit = {},
    maxRetries = 5
): Promise<T> {
    const { apiKey, apiToken } = getCredentials();

    // URLにクエリパラメータを追加
    const url = new URL(`${TRELLO_API_BASE}${endpoint}`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("token", apiToken);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url.toString(), {
                ...options,
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers,
                },
            });

            if (response.ok) {
                return (await response.json()) as T;
            }

            // 429 (Rate Limit) の場合はリトライ
            if (response.status === 429) {
                const sleepTime = Math.pow(2, attempt + 1) * 1000 + Math.random() * 1000;
                console.warn(
                    `Trello API 429: Retrying in ${sleepTime}ms (${attempt + 1}/${maxRetries})`
                );
                await new Promise((resolve) => setTimeout(resolve, sleepTime));
                lastError = new Error(`API Rate Limit (429)`);
                continue;
            }

            // その他のエラー
            const errorText = await response.text();
            throw new Error(`Trello API Error ${response.status}: ${errorText}`);
        } catch (error) {
            if (error instanceof Error && error.message.includes("Rate Limit")) {
                lastError = error;
                continue;
            }
            throw error;
        }
    }

    throw lastError || new Error("Max retries exceeded");
}

// Trello API 型定義
export interface TrelloList {
    id: string;
    name: string;
}

export interface TrelloLabel {
    name: string;
    color: string;
}

export interface TrelloCheckItem {
    name: string;
    state: "complete" | "incomplete";
}

export interface TrelloChecklist {
    name: string;
    checkItems: TrelloCheckItem[];
}

export interface TrelloCustomFieldItem {
    idCustomField: string;
    idValue?: string;
    value?: {
        number?: number;
        text?: string;
    };
}

export interface TrelloCard {
    id: string;
    name: string;
    shortLink: string;
    shortUrl: string;
    idList: string;
    due: string | null;
    dueComplete: boolean;
    labels: TrelloLabel[];
    desc: string;
    checklists?: TrelloChecklist[];
    customFieldItems?: TrelloCustomFieldItem[];
}

export interface TrelloCustomField {
    id: string;
    name: string;
    options?: {
        id: string;
        value: { text: string };
    }[];
}

/**
 * ボードのリスト一覧を取得
 */
export async function getBoardLists(boardId: string): Promise<TrelloList[]> {
    return trelloFetch<TrelloList[]>(`/boards/${boardId}/lists?filter=open`);
}

/**
 * ボードのカード一覧を取得（チェックリスト・カスタムフィールド付き）
 */
export async function getBoardCards(boardId: string): Promise<TrelloCard[]> {
    return trelloFetch<TrelloCard[]>(
        `/boards/${boardId}/cards?fields=name,id,shortLink,shortUrl,idList,due,dueComplete,labels,desc&checklists=all&customFieldItems=true`
    );
}

/**
 * ボードのカスタムフィールド定義を取得
 */
export async function getBoardCustomFields(
    boardId: string
): Promise<TrelloCustomField[]> {
    return trelloFetch<TrelloCustomField[]>(`/boards/${boardId}/customFields`);
}

/**
 * カードを別リストへ移動
 */
export async function moveCard(
    cardId: string,
    newListId: string
): Promise<void> {
    await trelloFetch(`/cards/${cardId}?idList=${newListId}`, { method: "PUT" });
}

/**
 * カードの期限を更新
 */
export async function updateCardDue(
    cardId: string,
    due: string | null
): Promise<void> {
    const dueValue = due || "null";
    await trelloFetch(`/cards/${cardId}?due=${dueValue}`, { method: "PUT" });
}

/**
 * カードにコメントを投稿
 */
export async function postCardComment(
    cardId: string,
    text: string
): Promise<{ id: string }> {
    return trelloFetch<{ id: string }>(`/cards/${cardId}/actions/comments`, {
        method: "POST",
        body: JSON.stringify({ text }),
    });
}

/**
 * コメントを削除
 */
export async function deleteComment(commentId: string): Promise<void> {
    await trelloFetch(`/actions/${commentId}`, { method: "DELETE" });
}

/**
 * カードの説明を更新
 */
export async function updateCardDescription(
    cardId: string,
    description: string
): Promise<void> {
    await trelloFetch(`/cards/${cardId}`, {
        method: "PUT",
        body: JSON.stringify({ desc: description }),
    });
}

/**
 * カスタムフィールド（リスト型）を更新
 */
export async function updateListCustomField(
    cardId: string,
    customFieldId: string,
    optionId: string | null
): Promise<void> {
    const payload = optionId ? { idValue: optionId } : { value: "" };
    await trelloFetch(`/cards/${cardId}/customField/${customFieldId}/item`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}

/**
 * カードのコメント一覧を取得
 */
export async function getCardComments(
    cardId: string
): Promise<
    {
        id: string;
        date: string;
        data: { text: string };
        memberCreator: { fullName: string };
    }[]
> {
    return trelloFetch(`/cards/${cardId}/actions?filter=commentCard&limit=50`);
}


