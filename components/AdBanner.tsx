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
    }, []);

    if (!isMounted) return null;

    return (
        <div className={cn("flex justify-center items-center my-4 overflow-hidden", className)}>
            <ins
                className="kakao_ad_area"
                style={{
                    display: "block", // none이 아니라 block으로 되어 있어야 스크립트가 인식합니다.
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