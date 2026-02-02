import { useCallback, useRef } from 'react';

export function useDraggableScroll() {
    // 要素への参照を保持
    const elementRef = useRef<HTMLElement | null>(null);

    // ドラッグ状態を保持（再レンダリングを避けるためref使用）
    const stateRef = useRef({
        isDragging: false,
        startX: 0,
        startY: 0,
        scrollLeft: 0,
        scrollTop: 0,
    });

    const onMouseMove = useCallback((e: MouseEvent) => {
        const ele = elementRef.current;
        const state = stateRef.current;

        if (!ele || !state.isDragging) return;

        e.preventDefault(); // テキスト選択などを防止

        const x = e.clientX;
        const y = e.clientY;

        const walkX = (x - state.startX) * 1; // スクロール速度
        const walkY = (y - state.startY) * 1;

        ele.scrollLeft = state.scrollLeft - walkX;
        ele.scrollTop = state.scrollTop - walkY;
    }, []);

    const onMouseUp = useCallback(() => {
        const ele = elementRef.current;
        const state = stateRef.current;

        if (state.isDragging && ele) {
            state.isDragging = false;
            ele.style.cursor = 'grab';
            ele.style.removeProperty('user-select');
        }

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }, [onMouseMove]);

    const onMouseDown = useCallback((e: MouseEvent) => {
        const ele = elementRef.current;
        if (!ele) return;

        // インタラクティブ要素やDnDハンドル上のクリックは無視
        const target = e.target as HTMLElement;
        if (
            target.tagName === 'BUTTON' ||
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'A' ||
            target.closest('[role="button"]') ||
            target.closest('[data-no-drag]') ||
            target.closest('.card-item') // カード自体も除外
        ) {
            return;
        }

        const state = stateRef.current;
        state.isDragging = true;
        state.startX = e.clientX;
        state.startY = e.clientY;
        state.scrollLeft = ele.scrollLeft;
        state.scrollTop = ele.scrollTop;

        ele.style.cursor = 'grabbing';
        ele.style.userSelect = 'none';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [onMouseMove, onMouseUp]);

    // Callback Ref Pattern
    // 要素がマウント/アンマウントされるたびに呼ばれる
    const callbackRef = useCallback((node: HTMLElement | null) => {
        if (elementRef.current) {
            // クリーンアップ
            elementRef.current.removeEventListener('mousedown', onMouseDown);
            elementRef.current = null;
        }

        if (node) {
            // 初期化
            elementRef.current = node;
            node.style.cursor = 'grab';
            node.style.overflowX = 'auto';
            node.addEventListener('mousedown', onMouseDown);
        }
    }, [onMouseDown]);

    return callbackRef;
}
