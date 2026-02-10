"use client";

import { useEffect, useState } from "react";

interface AdFitProps {
    unitId: string;
    width: string;
    height: string;
    className?: string;
}

export default function AdBanner({ unitId, width, height, className }: AdFitProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);

        const scriptId = "kakao-adfit-script";
        let script = document.getElementById(scriptId) as HTMLScriptElement;

        if (!script) {
            script = document.createElement("script");
            script.id = scriptId;
            script.src = "https://t1.daumcdn.net/kas/static/ba.min.js";
            script.async = true;
            document.head.appendChild(script);
        }

        // 함수가 없을 때를 대비한 방어 로직 (setTimeout으로 지연 호출)
        const loadAd = () => {
            const win = window as any;
            if (win.adfit && typeof win.adfit.display === 'function') {
                win.adfit.display(unitId);
            }
        };

        const timer = setTimeout(loadAd, 500); // 스크립트 로드 대기 시간 부여
        return () => clearTimeout(timer);
    }, [unitId]);

    // Hydration 에러 방지: 마운트 전에는 아무것도 그리지 않음
    if (!isMounted) {
        return <div style={{ width: `${width}px`, height: `${height}px` }} className={className} />;
    }

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