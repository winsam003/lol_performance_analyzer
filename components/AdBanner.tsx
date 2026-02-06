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

        // 광고 호출 로직을 함수화하여 안전하게 실행합니다.
        const loadAd = () => {
            if (typeof window !== "undefined" && (window as any).adfit) {
                try {
                    // 수동 호출 함수가 존재하면 실행
                    if (typeof (window as any).adfit.display === 'function') {
                        (window as any).adfit.display();
                    }
                } catch (e) {
                    console.warn("Adfit display error:", e);
                }
            }
        };

        const timer = setTimeout(loadAd, 200); // DOM 안착을 위해 시간을 조금 더 넉넉히 줍니다.
        return () => clearTimeout(timer);
    }, [unitId]);

    if (!isMounted) return null;

    return (
        <div className={cn("flex justify-center items-center my-4 relative min-h-[50px]", className)}>
            <ins
                className="kakao_ad_area"
                style={{ display: "none" }}
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