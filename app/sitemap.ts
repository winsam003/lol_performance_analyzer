import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: 'https://lol.winsam.xyz',
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        // 분석 페이지나 랭킹 페이지가 있다면 추가
    ]
}