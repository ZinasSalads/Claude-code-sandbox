"""Environmental Intelligence — UV, AQI, pollen, weather data.

Sources:
- OpenWeatherMap: weather, UV index, AQI
- Open-Meteo: free fallback for weather + UV
- Ambee: pollen data (optional)

Caches daily in environmental_data table.
"""

import logging
from datetime import date
from typing import Optional

import httpx

from config import OPENWEATHER_API_KEY, AMBEE_API_KEY, supabase

logger = logging.getLogger("concierge.environment")


class EnvironmentService:
    """Fetches and caches environmental data for health recommendations."""

    async def get_today(self, lat: Optional[float] = None, lon: Optional[float] = None) -> dict:
        """Get today's environmental data, from cache or fresh fetch."""
        # Check cache first
        cached = await self._get_cached(date.today().isoformat())
        if cached:
            return cached

        # Need location
        if lat is None or lon is None:
            # Try to get from user profile
            loc = await self._get_user_location()
            if loc:
                lat, lon = loc
            else:
                return {"error": "No location configured. Set location in your profile."}

        # Fetch fresh data
        data = await self._fetch_all(lat, lon)
        if data:
            await self._cache(data)
        return data

    async def _get_user_location(self) -> Optional[tuple[float, float]]:
        """Get user's location from life_profile table."""
        if not supabase:
            return None
        try:
            result = (
                supabase.table("life_profile")
                .select("value")
                .eq("key", "location")
                .limit(1)
                .execute()
            )
            if result.data:
                val = result.data[0].get("value", {})
                if isinstance(val, dict) and "lat" in val and "lon" in val:
                    return (val["lat"], val["lon"])
        except Exception as e:
            logger.error(f"Failed to get user location: {e}")
        return None

    async def _fetch_all(self, lat: float, lon: float) -> dict:
        """Fetch weather, UV, AQI, and pollen data."""
        data = {
            "date": date.today().isoformat(),
            "location_lat": lat,
            "location_lon": lon,
        }

        # Weather + UV from OpenWeatherMap or Open-Meteo fallback
        if OPENWEATHER_API_KEY:
            weather = await self._fetch_openweather(lat, lon)
            data.update(weather)
            aqi = await self._fetch_openweather_aqi(lat, lon)
            data.update(aqi)
        else:
            weather = await self._fetch_open_meteo(lat, lon)
            data.update(weather)
            # AQI from Open-Meteo Air Quality API (free, no key)
            aqi = await self._fetch_open_meteo_aqi(lat, lon)
            data.update(aqi)

        # Pollen from Ambee or Open-Meteo fallback
        if AMBEE_API_KEY:
            pollen = await self._fetch_ambee_pollen(lat, lon)
            data.update(pollen)
        else:
            pollen = await self._fetch_open_meteo_pollen(lat, lon)
            data.update(pollen)

        # Compute safety recommendations
        data["outdoor_exercise_safe"] = self._is_outdoor_safe(data)
        data["sunscreen_required"] = (data.get("uv_index_max") or 0) >= 3
        data["air_quality_notes"] = self._air_quality_notes(data)

        return data

    async def _fetch_openweather(self, lat: float, lon: float) -> dict:
        """Fetch weather and UV from OpenWeatherMap."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                # Current weather
                resp = await client.get(
                    "https://api.openweathermap.org/data/2.5/weather",
                    params={"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY, "units": "metric"},
                )
                if resp.status_code == 200:
                    w = resp.json()
                    result = {
                        "location_name": w.get("name", ""),
                        "temp_c": w.get("main", {}).get("temp"),
                        "humidity": w.get("main", {}).get("humidity"),
                        "conditions": w.get("weather", [{}])[0].get("description", ""),
                        "wind_kph": round((w.get("wind", {}).get("speed", 0)) * 3.6, 1),
                    }
                else:
                    result = {}

                # UV index
                uv_resp = await client.get(
                    "https://api.openweathermap.org/data/2.5/uvi",
                    params={"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY},
                )
                if uv_resp.status_code == 200:
                    uv = uv_resp.json()
                    uv_val = uv.get("value", 0)
                    result["uv_index_current"] = uv_val
                    result["uv_index_max"] = uv_val  # Current as proxy for max
                    result["uv_risk_level"] = self._uv_risk(uv_val)

                return result
        except Exception as e:
            logger.error(f"OpenWeatherMap fetch error: {e}")
            return {}

    async def _fetch_openweather_aqi(self, lat: float, lon: float) -> dict:
        """Fetch AQI from OpenWeatherMap."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.openweathermap.org/data/2.5/air_pollution",
                    params={"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    components = data.get("list", [{}])[0].get("components", {})
                    aqi = data.get("list", [{}])[0].get("main", {}).get("aqi", 0)
                    # OpenWeatherMap AQI: 1=Good, 2=Fair, 3=Moderate, 4=Poor, 5=Very Poor
                    aqi_map = {1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor", 5: "Very Poor"}
                    return {
                        "aqi": aqi * 50,  # Rough conversion to US AQI scale
                        "pm25": components.get("pm2_5"),
                        "pm10": components.get("pm10"),
                        "aqi_category": aqi_map.get(aqi, "Unknown"),
                    }
        except Exception as e:
            logger.error(f"OpenWeatherMap AQI fetch error: {e}")
        return {}

    async def _fetch_open_meteo(self, lat: float, lon: float) -> dict:
        """Fetch weather + UV from Open-Meteo (free, no API key)."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,uv_index",
                        "daily": "uv_index_max",
                        "timezone": "auto",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    current = data.get("current", {})
                    daily = data.get("daily", {})
                    uv_max = (daily.get("uv_index_max") or [0])[0]
                    uv_current = current.get("uv_index", 0)
                    return {
                        "temp_c": current.get("temperature_2m"),
                        "humidity": current.get("relative_humidity_2m"),
                        "wind_kph": current.get("wind_speed_10m"),
                        "uv_index_current": uv_current,
                        "uv_index_max": uv_max,
                        "uv_risk_level": self._uv_risk(uv_max),
                    }
        except Exception as e:
            logger.error(f"Open-Meteo fetch error: {e}")
        return {}

    async def _fetch_open_meteo_aqi(self, lat: float, lon: float) -> dict:
        """Fetch AQI from Open-Meteo Air Quality API (free, no key)."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://air-quality-api.open-meteo.com/v1/air-quality",
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "current": "us_aqi,pm2_5,pm10",
                    },
                )
                if resp.status_code == 200:
                    current = resp.json().get("current", {})
                    aqi_val = current.get("us_aqi", 0)
                    if aqi_val <= 50:
                        category = "Good"
                    elif aqi_val <= 100:
                        category = "Moderate"
                    elif aqi_val <= 150:
                        category = "Unhealthy for Sensitive"
                    elif aqi_val <= 200:
                        category = "Unhealthy"
                    elif aqi_val <= 300:
                        category = "Very Unhealthy"
                    else:
                        category = "Hazardous"
                    return {
                        "aqi": aqi_val,
                        "pm25": current.get("pm2_5"),
                        "pm10": current.get("pm10"),
                        "aqi_category": category,
                    }
        except Exception as e:
            logger.error(f"Open-Meteo AQI fetch error: {e}")
        return {}

    async def _fetch_open_meteo_pollen(self, lat: float, lon: float) -> dict:
        """Fetch pollen data from Open-Meteo (free, no key). Available in Europe and North America."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://air-quality-api.open-meteo.com/v1/air-quality",
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "current": "birch_pollen,grass_pollen,ragweed_pollen",
                    },
                )
                if resp.status_code == 200:
                    current = resp.json().get("current", {})
                    tree = current.get("birch_pollen") or 0
                    grass = current.get("grass_pollen") or 0
                    weed = current.get("ragweed_pollen") or 0
                    max_val = max(tree, grass, weed)
                    # Classify pollen risk based on grains/m³
                    if max_val < 10:
                        risk = "Low"
                    elif max_val < 50:
                        risk = "Moderate"
                    elif max_val < 100:
                        risk = "High"
                    else:
                        risk = "Very High"
                    return {
                        "pollen_tree": tree,
                        "pollen_grass": grass,
                        "pollen_weed": weed,
                        "pollen_risk_level": risk,
                    }
        except Exception as e:
            logger.error(f"Open-Meteo pollen fetch error: {e}")
        return {}

    async def _fetch_ambee_pollen(self, lat: float, lon: float) -> dict:
        """Fetch pollen data from Ambee."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.ambeedata.com/latest/pollen/by-lat-lng",
                    params={"lat": lat, "lng": lon},
                    headers={"x-api-key": AMBEE_API_KEY, "Content-type": "application/json"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    pollen = data.get("data", [{}])[0] if data.get("data") else {}
                    count = pollen.get("Count", {})
                    risk = pollen.get("Risk", {})
                    tree = count.get("tree_pollen", 0)
                    grass = count.get("grass_pollen", 0)
                    weed = count.get("weed_pollen", 0)
                    max_risk = max(
                        risk.get("tree_pollen", "Low"),
                        risk.get("grass_pollen", "Low"),
                        risk.get("weed_pollen", "Low"),
                        key=lambda x: {"Low": 0, "Moderate": 1, "High": 2, "Very High": 3}.get(x, 0),
                    )
                    return {
                        "pollen_tree": tree,
                        "pollen_grass": grass,
                        "pollen_weed": weed,
                        "pollen_risk_level": max_risk,
                    }
        except Exception as e:
            logger.error(f"Ambee pollen fetch error: {e}")
        return {}

    def _uv_risk(self, uv: float) -> str:
        if uv < 3:
            return "Low"
        elif uv < 6:
            return "Moderate"
        elif uv < 8:
            return "High"
        elif uv < 11:
            return "Very High"
        return "Extreme"

    def _is_outdoor_safe(self, data: dict) -> bool:
        """Determine if outdoor exercise is recommended."""
        aqi = data.get("aqi") or 0
        uv = data.get("uv_index_current") or 0
        temp = data.get("temp_c")

        if aqi > 150:
            return False
        if temp is not None and (temp > 40 or temp < -15):
            return False
        return True

    def _air_quality_notes(self, data: dict) -> str:
        """Generate air quality recommendation."""
        aqi = data.get("aqi") or 0
        uv = data.get("uv_index_max") or 0
        pollen = data.get("pollen_risk_level", "Low")

        notes = []
        if aqi > 100:
            notes.append(f"AQI is {aqi} — consider indoor exercise today.")
        if uv >= 6:
            notes.append(f"UV index {uv} — wear sunscreen and avoid midday sun.")
        if pollen in ("High", "Very High"):
            notes.append(f"Pollen risk is {pollen} — allergy sufferers should exercise indoors.")
        if not notes:
            notes.append("Air quality and conditions are good for outdoor activity.")
        return " ".join(notes)

    async def _get_cached(self, date_str: str) -> Optional[dict]:
        """Get cached environmental data for a date."""
        if not supabase:
            return None
        try:
            result = (
                supabase.table("environmental_data")
                .select("*")
                .eq("date", date_str)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Cache read error: {e}")
            return None

    async def _cache(self, data: dict) -> None:
        """Cache environmental data."""
        if not supabase:
            return
        try:
            supabase.table("environmental_data").upsert(data, on_conflict="date").execute()
        except Exception as e:
            logger.error(f"Cache write error: {e}")


environment_service = EnvironmentService()
