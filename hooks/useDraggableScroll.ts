import { useRef, useEffect } from 'react';

export function useDraggableScroll() {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ele = ref.current;
        if (!ele) return;

        let pos = { top: 0, left: 0, x: 0, y: 0 };
        let isDragging = false;

        const onMouseDown = (e: MouseEvent) => {
            // インタラクティブ要素やDnDハンドル上のクリックは無視
            const target = e.target as HTMLElement;
            if (
                target.tagName === 'BUTTON' ||
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'A' ||
                target.closest('[role="button"]') ||
                target.closest('[data-no-drag]') ||
                target.closest('.card-item') // カード自体も除外（カード移動と区別）
            ) {
                return;
            }

            isDragging = true;
            ele.style.cursor = 'grabbing';
            ele.style.userSelect = 'none';

            pos = {
                left: ele.scrollLeft,
                top: ele.scrollTop,
                x: e.clientX,
                y: e.clientY,
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            e.preventDefault(); // テキスト選択などを防止

            const dx = e.clientX - pos.x;
            const dy = e.clientY - pos.y;

            // スクロール速度係数 (必要に応じて調整)
            const speed = 1.0;

            ele.scrollLeft = pos.left - dx * speed;
            ele.scrollTop = pos.top - dy * speed;
        };

        const onMouseUp = () => {
            isDragging = false;
            ele.style.cursor = 'grab';
            ele.style.removeProperty('user-select');

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        // 初期スタイル
        ele.style.cursor = 'grab';
        // overflow-x-auto クラスが適用されていることを前提とするが、念のため
        ele.style.overflowX = 'auto';

        ele.addEventListener('mousedown', onMouseDown);

        return () => {
            ele.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    return ref;
}
