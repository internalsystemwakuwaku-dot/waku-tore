"use client";

import { useBoardStore } from "@/stores/boardStore";
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
} from "chart.js";
import { Pie, Bar } from "react-chartjs-2";

// Chart.jsの登録
ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    Title
);

interface DashboardModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * ダッシュボードモーダル - GAS完全再現版
 * - 担当者別円グラフ
 * - リスト別棒グラフ
 */
export function DashboardModal({ isOpen, onClose }: DashboardModalProps) {
    const { data } = useBoardStore();

    if (!isOpen || !data) return null;

    // --- データ集計 ---

    // 1. リスト別カード数
    const listCardCounts = data.lists.map((list) => {
        const count = data.cards.filter((c) => c.idList === list.id).length;
        return { name: list.name, count };
    });

    // 2. 担当者別カード数 (各役割ごと)
    const countByRole = (roleType: "construction" | "system" | "sales" | "mtg") => {
        const counts: Record<string, number> = {};
        data.members[roleType].forEach((member) => {
            if (member === "未設定" || member === "(未設定)") return;
            counts[member] = 0;
        });

        data.cards.forEach((card) => {
            const member = card.roles[roleType];
            if (member && member !== "未設定" && member !== "(未設定)") {
                counts[member] = (counts[member] || 0) + 1;
            }
        });

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1]) // 多い順
            .filter(([_, count]) => count > 0); // 0件は除外
    };

    const constructionData = countByRole("construction");
    const systemData = countByRole("system");
    const salesData = countByRole("sales");
    const mtgData = countByRole("mtg");

    // --- グラフデータ作成 ---

    // カラーパレット
    const colors = [
        "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40",
        "#E7E9ED", "#76D7C4", "#F7DC6F", "#F1948A", "#82E0AA", "#D7BDE2"
    ];

    const createPieData = (label: string, dataPoints: [string, number][]) => ({
        labels: dataPoints.map(([name]) => name),
        datasets: [
            {
                label: "件数",
                data: dataPoints.map(([_, count]) => count),
                backgroundColor: colors,
                borderWidth: 1,
            },
        ],
    });

    const barData = {
        labels: listCardCounts.map((l) => l.name),
        datasets: [
            {
                label: "カード数",
                data: listCardCounts.map((l) => l.count),
                backgroundColor: "#36A2EB",
            },
        ],
    };

    const barOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: "top" as const,
            },
            title: {
                display: true,
                text: "リスト別カード分布",
            },
        },
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="material-icons">analytics</span> ダッシュボード
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        ✕ 閉じる
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* リスト別チャート */}
                        <div className="bg-white p-6 rounded-lg shadow col-span-1 lg:col-span-2">
                            <h3 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">📊 リスト状況</h3>
                            <div className="h-[300px] w-full">
                                <Bar options={barOptions} data={barData} />
                            </div>
                        </div>

                        {/* 担当者別チャート (円グラフ x 4) */}
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">🛠️ 構築担当</h3>
                            <div className="h-[250px] flex justify-center">
                                {constructionData.length > 0 ? (
                                    <Pie data={createPieData("構築", constructionData)} />
                                ) : (
                                    <p className="text-gray-400 self-center">データなし</p>
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">💻 システム担当</h3>
                            <div className="h-[250px] flex justify-center">
                                {systemData.length > 0 ? (
                                    <Pie data={createPieData("システム", systemData)} />
                                ) : (
                                    <p className="text-gray-400 self-center">データなし</p>
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">💼 商談担当</h3>
                            <div className="h-[250px] flex justify-center">
                                {salesData.length > 0 ? (
                                    <Pie data={createPieData("商談", salesData)} />
                                ) : (
                                    <p className="text-gray-400 self-center">データなし</p>
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">🤝 MTG担当</h3>
                            <div className="h-[250px] flex justify-center">
                                {mtgData.length > 0 ? (
                                    <Pie data={createPieData("MTG", mtgData)} />
                                ) : (
                                    <p className="text-gray-400 self-center">データなし</p>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
