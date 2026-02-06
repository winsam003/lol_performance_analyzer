"use client";

import { useEffect, useState } from "react";

interface AdFitProps {
    unitId: string;
    width: string;
    height: string;
    className?: string;
}

export default function AdBanner({ unitId, width, height, className }: AdFitProps) {
    // 마운트 여부 확인을 위한 상태
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);

        try {
            // 스크립트가 이미 로드된 상태에서 동적으로 추가된 광고를 스캔하도록 유도
            if ((window as any).adfit) {
                // 필요 시 추가 로직
            }
        } catch (e) {
            console.error("Adfit error:", e);
        }
    }, []);

    // 서버 사이드에서는 아무것도 렌더링하지 않음 (Hydration 에러 방지)
    if (!isMounted) return null;

    return (
        <div className={cn("flex justify-center items-center my-4 relative", className)}>
            <ins
                className="kakao_ad_area"
                style={{ display: "none" }}
                data-ad-unit={unitId}
                data-ad-width={width}
                data-ad-height={height}
            ></ins>

            {/* 가이드 영역: zIndex를 제거하거나 0으로 설정해서 보이게 수정 */}
            {isMounted && (
                <div
                    className="bg-white/5 border border-dashed border-white/20 flex flex-col items-center justify-center rounded-xl"
                    style={{
                        width: `${width}px`,
                        height: `${height}px`,
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 0 // -1에서 0으로 변경하여 배경 위로 올림
                    }}
                >
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Adfit Area</span>
                    <span className="text-[12px] text-slate-400 font-black italic">{width} x {height}</span>
                </div>
            )}
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(" ");
}