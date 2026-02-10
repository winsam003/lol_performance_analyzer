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

        // 1. 광고 스크립트가 이미 있는지 확인하고 없으면 추가
        const scriptId = "kakao-adfit-script";
        let script = document.getElementById(scriptId) as HTMLScriptElement;

        if (!script) {
            script = document.createElement("script");
            script.id = scriptId;
            script.src = "https://t1.daumcdn.net/kas/static/ba.min.js";
            script.async = true;
            document.head.appendChild(script);
        }

        // 2. 스크립트가 로드된 후 광고를 렌더링하도록 수동 호출 (필요 시)
        // 애드핏은 ba.min.js가 로드될 때 페이지 내 모든 kakao_ad_area를 찾습니다.
    }, [unitId]);

    if (!isMounted) return null;

    return (
        <div className={cn("flex justify-center items-center my-4 overflow-hidden", className)}>
            <ins
                className="kakao_ad_area"
                style={{
                    display: "block",
                    width: `${width}px`,
                    height: `${height}px`,
                    textDecoration: "none"
                }}
                data-ad-unit={unitId}
                data-ad-width={width}
                data-ad-height={height}
            ></ins>
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(" ");
}