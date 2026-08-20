import {useEffect, useState} from 'react'

export interface GeoData {
    timezone: string
    countryCode: string | null
    countryName: string | null
    city: string | null
    loading: boolean
    error: string | null
}

// Two free IP geolocation services with no API key required. We try
// them in order and use the first one that succeeds — gives us
// resilience against rate limits, downtime, and ad-blockers.
const SOURCES: {
    url: string
    parse: (json: any) => {
        countryCode: string | null
        countryName: string | null
        city: string | null
        timezone: string | null
    }
}[] = [
    {
        url: 'https://ipwho.is/',
        parse: (json) => ({
            countryCode: json?.country_code ?? null,
            countryName: json?.country ?? null,
            city: json?.city ?? null,
            timezone: json?.timezone?.id ?? null,
        }),
    },
    {
        url: 'https://ipapi.co/json/',
        parse: (json) => ({
            countryCode: json?.country_code ?? null,
            countryName: json?.country_name ?? null,
            city: json?.city ?? null,
            timezone: json?.timezone ?? null,
        }),
    },
]

/**
 * Auto-detect the user's location. Timezone always comes from Intl
 * (never fails). Country and city come from one of several IP-based
 * APIs — falls back to the next on any failure.
 */
export function useGeolocation(): GeoData {
    const [data, setData] = useState<GeoData>({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        countryCode: null,
        countryName: null,
        city: null,
        loading: true,
        error: null,
    })

    useEffect(() => {
        let cancelled = false

        const run = async () => {
            for (const source of SOURCES) {
                try {
                    const res = await fetch(source.url)
                    if (!res.ok) continue
                    const json = await res.json()
                    const parsed = source.parse(json)
                    // ipwho.is returns success:false when blocked — guard with countryCode
                    if (!parsed.countryCode) continue
                    if (cancelled) return
                    setData((prev) => ({
                        ...prev,
                        countryCode: parsed.countryCode,
                        countryName: parsed.countryName,
                        city: parsed.city,
                        timezone: parsed.timezone || prev.timezone,
                        loading: false,
                    }))
                    return
                } catch {
                    // Network error, CORS, ad-blocker — try the next source.
                    continue
                }
            }
            // Every source failed. Surface the error so the UI can switch
            // to manual entry; timezone is still populated from Intl.
            if (cancelled) return
            setData((prev) => ({
                ...prev,
                loading: false,
                error: 'Could not auto-detect your location. Please pick it manually.',
            }))
        }

        run()
        return () => {
            cancelled = true
        }
    }, [])

    return data
}
