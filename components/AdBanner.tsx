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

        const timer = setTimeout(() => {
            // window 객체와 adfit 객체가 존재하는지 먼저 확인합니다.
            if (typeof window !== "undefined" && (window as any).adfit) {
                try {
                    // display 함수가 실제로 존재하고 함수 타입인지 확인 후 호출합니다.
                    if (typeof (window as any).adfit.display === 'function') {
                        (window as any).adfit.display();
                    }
                } catch (e) {
                    console.warn("Adfit display error:", e);
                }
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [unitId]); // 유닛 ID가 변경될 때마다 광고를 다시 호출하도록 설정합니다.

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
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(" ");
}