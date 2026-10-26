"use client";

import { useEffect } from "react";

interface AdFitProps {
    unitId: string;
    width: string;
    height: string;
    className?: string;
}

export default function AdBanner({ unitId, width, height, className }: AdFitProps) {

    useEffect(() => {

        const scriptId = "kakao-adfit-script";
        let script = document.getElementById(scriptId) as HTMLScriptElement;

        if (!script) {
            script = document.createElement("script");
            script.id = scriptId;
            script.src = "https://t1.daumcdn.net/kas/static/ba.min.js";
            script.async = true;
            document.head.appendChild(script);
        }

        // Load once and initialize after the script is available.
        const loadAd = () => {
            const win = window as Window & { adfit?: { display: (id: string) => void } };
            if (win.adfit && typeof win.adfit.display === 'function') {
                win.adfit.display(unitId);
            }
        };

        script.addEventListener("load", loadAd);
        loadAd();
        return () => script.removeEventListener("load", loadAd);
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