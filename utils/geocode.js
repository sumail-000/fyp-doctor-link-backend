// Free OpenStreetMap Nominatim geocoder. No API key required, but the
// service requires a User-Agent and rate-limits to ~1 req/sec.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const geocode = async (query) => {
    if (!query || !query.trim()) return null;
    try {
        const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(query.trim())}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'DoctorLink/1.0 (FYP project)' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return null;
        const hit = data[0];
        const lat = parseFloat(hit.lat);
        const lon = parseFloat(hit.lon);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
        return { latitude: lat, longitude: lon };
    } catch (err) {
        console.error('[geocode] error:', err.message);
        return null;
    }
};

// Haversine distance in km
const haversineKm = (a, b) => {
    if (!a || !b) return null;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

module.exports = { geocode, haversineKm };
