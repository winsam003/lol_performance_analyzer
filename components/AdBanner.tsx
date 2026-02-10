"use client";

import { useEffect, useState } from "react";

interface AdFitProps {
    unitId: string;
    width: string;
    height: string;
    className?: string;
}

export default function AdBanner({ unitId, width, height, className }: AdFitProps) {
    useEffect(() => {
        // 1. 스크립트 로드 확인
        const scriptId = "kakao-adfit-script";
        let script = document.getElementById(scriptId) as HTMLScriptElement;

        if (!script) {
            script = document.createElement("script");
            script.id = scriptId;
            script.src = "https://t1.daumcdn.net/kas/static/ba.min.js";
            script.async = true;
            document.head.appendChild(script);
        }

        // 2. 이미 로드된 스크립트가 있다면, 새 광고 영역을 인식하도록 호출
        // Next.js 페이지 전환 시 필수입니다.
        const win = window as any;
        if (win.adfit) {
            win.adfit.display();
        }

        return () => {
            // 페이지를 벗어날 때 호출 (선택사항)
            if (win.adfit && win.adfit.destroy) {
                win.adfit.destroy(unitId);
            }
        };
    }, [unitId]);

    return (
        <div className={className} style={{ width: `${width}px`, height: `${height}px` }}>
            <ins
                className="kakao_ad_area"
                style={{ display: "block", textDecoration: "none" }}
                data-ad-unit={unitId}
                data-ad-width={width}
                data-ad-height={height}
            ></ins>
        </div>
    );
}