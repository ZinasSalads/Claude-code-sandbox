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

from config import OPENWEATHER_API_KEY, AMBEE_API_KEY, TOMORROW_API_KEY, supabase

logger = logging.getLogger("concierge.environment")


class EnvironmentService:
    """Fetches and caches environmental data for health recommendations."""

    async def get_today(self, lat: Optional[float] = None, lon: Optional[float] = None, force: bool = False) -> dict:
        """Get today's environmental data, from cache or fresh fetch."""
        if not force:
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

        # Tomorrow.io is the preferred source (covers weather + UV + AQI + pollen in one call)
        if TOMORROW_API_KEY:
            tomorrow_data = await self._fetch_tomorrow_io(lat, lon)
            data.update(tomorrow_data)
        else:
            # Weather + UV from OpenWeatherMap or Open-Meteo fallback
            if OPENWEATHER_API_KEY:
                weather = await self._fetch_openweather(lat, lon)
                data.update(weather)
                aqi = await self._fetch_openweather_aqi(lat, lon)
                data.update(aqi)
            else:
                weather = await self._fetch_open_meteo(lat, lon)
                data.update(weather)
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

    async def _fetch_tomorrow_io(self, lat: float, lon: float) -> dict:
        """Fetch weather, UV, AQI, and pollen from Tomorrow.io (single API key covers all)."""
        result = {}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                # Realtime weather + UV + AQI
                resp = await client.get(
                    "https://api.tomorrow.io/v4/weather/realtime",
                    params={
                        "location": f"{lat},{lon}",
                        "apikey": TOMORROW_API_KEY,
                        "fields": "temperature,humidity,windSpeed,uvIndex,weatherCode,particulateMatter25,particulateMatter10,pollutantO3,epaIndex,epaHealthConcern",
                        "units": "metric",
                    },
                )
                if resp.status_code == 200:
                    values = resp.json().get("data", {}).get("values", {})
                    uv = values.get("uvIndex", 0)
                    aqi = values.get("epaIndex", 0)
                    aqi_labels = {1: "Good", 2: "Moderate", 3: "Unhealthy for Sensitive", 4: "Unhealthy", 5: "Very Unhealthy", 6: "Hazardous"}
                    wc = values.get("weatherCode", 1000)
                    result.update({
                        "temp_c": round(values.get("temperature", 0)),
                        "humidity": round(values.get("humidity", 0)),
                        "wind_kph": round(values.get("windSpeed", 0) * 3.6, 1),
                        "uv_index_current": round(uv, 1),
                        "uv_index_max": round(uv, 1),
                        "uv_risk_level": self._uv_risk(uv),
                        "aqi": aqi * 50,
                        "pm25": values.get("particulateMatter25"),
                        "pm10": values.get("particulateMatter10"),
                        "aqi_category": aqi_labels.get(aqi, "Unknown"),
                        "weather_code": wc,
                        "conditions": self._tomorrow_weather_code(wc),
                    })

                # Pollen forecast
                pollen_resp = await client.get(
                    "https://api.tomorrow.io/v4/pollen/forecasts/daily",
                    params={
                        "location": f"{lat},{lon}",
                        "apikey": TOMORROW_API_KEY,
                        "days": 1,
                        "units": "metric",
                    },
                )
                if pollen_resp.status_code == 200:
                    pollen_data = pollen_resp.json().get("data", {}).get("timelines", [{}])[0].get("intervals", [{}])[0].get("values", {})
                    tree = pollen_data.get("treeIndex", 0)
                    grass = pollen_data.get("grassIndex", 0)
                    weed = pollen_data.get("weedIndex", 0)
                    max_val = max(tree, grass, weed)
                    pollen_labels = {0: "None", 1: "Very Low", 2: "Low", 3: "Moderate", 4: "High", 5: "Very High"}
                    result.update({
                        "pollen_tree": tree,
                        "pollen_grass": grass,
                        "pollen_weed": weed,
                        "pollen_risk_level": pollen_labels.get(max_val, "Low"),
                    })
        except Exception as e:
            logger.error(f"Tomorrow.io fetch error: {e}")
        return result

    def _tomorrow_weather_code(self, code: int) -> str:
        """Convert Tomorrow.io weather code to human-readable text."""
        codes = {
            1000: "Clear", 1001: "Cloudy", 1100: "Mostly Clear", 1101: "Partly Cloudy",
            1102: "Mostly Cloudy", 2000: "Fog", 2100: "Light Fog",
            4000: "Drizzle", 4001: "Rain", 4200: "Light Rain", 4201: "Heavy Rain",
            5000: "Snow", 5001: "Flurries", 5100: "Light Snow", 5101: "Heavy Snow",
            6000: "Freezing Drizzle", 6001: "Freezing Rain", 7000: "Ice Pellets",
            8000: "Thunderstorm",
        }
        return codes.get(code, "Clear")

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
                    uv_max_list = daily.get("uv_index_max") or []
                    uv_max = uv_max_list[0] if uv_max_list else None
                    uv_current = current.get("uv_index")
                    wc = current.get("weather_code", 0)
                    result = {
                        "temp_c": round(current.get("temperature_2m") or 0),
                        "humidity": round(current.get("relative_humidity_2m") or 0),
                        "wind_kph": round(current.get("wind_speed_10m") or 0),
                        "weather_code": wc,
                        "conditions": self._weather_code_to_text(wc),
                    }
                    if uv_max is not None:
                        result["uv_index_max"] = round(uv_max, 1)
                        result["uv_risk_level"] = self._uv_risk(uv_max)
                    if uv_current is not None:
                        result["uv_index_current"] = round(uv_current, 1)
                    return result
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
                        "current": "us_aqi,european_aqi,pm2_5,pm10",
                    },
                )
                if resp.status_code == 200:
                    current = resp.json().get("current", {})
                    aqi_val = current.get("us_aqi")
                    eu_aqi = current.get("european_aqi")
                    # Use US AQI if available, otherwise convert European AQI
                    if aqi_val is None or aqi_val == 0:
                        if eu_aqi is not None and eu_aqi > 0:
                            # Rough EU→US mapping: EU scale 0-100 ≈ US 0-150
                            aqi_val = round(eu_aqi * 1.5)
                        else:
                            return {"pm25": current.get("pm2_5"), "pm10": current.get("pm10")}
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

    def _weather_code_to_text(self, code: int) -> str:
        """Convert WMO weather code to human-readable text."""
        codes = {
            0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Fog", 48: "Rime fog",
            51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
            56: "Freezing drizzle", 57: "Heavy freezing drizzle",
            61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
            66: "Light freezing rain", 67: "Heavy freezing rain",
            71: "Light snow", 73: "Moderate snow", 75: "Heavy snow",
            77: "Snow grains",
            80: "Light showers", 81: "Moderate showers", 82: "Violent showers",
            85: "Light snow showers", 86: "Heavy snow showers",
            95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm",
        }
        return codes.get(code, "Unknown")

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
            if result.data:
                cached = result.data[0]
                # Re-fetch if conditions are missing (partial cache)
                if cached.get("conditions") is None:
                    return None
                # Derive weather_code from conditions for frontend emoji mapping
                cached["weather_code"] = self._conditions_to_weather_code(cached.get("conditions", ""))
                return cached
            return None
        except Exception as e:
            logger.error(f"Cache read error: {e}")
            return None

    def _conditions_to_weather_code(self, conditions: str) -> int:
        """Reverse-map conditions text to a WMO weather code for frontend display."""
        c = (conditions or "").lower()
        if "thunderstorm" in c:
            return 95
        if "heavy rain" in c or "violent" in c:
            return 65
        if "rain" in c or "shower" in c:
            return 61
        if "drizzle" in c:
            return 51
        if "heavy snow" in c:
            return 75
        if "snow" in c:
            return 71
        if "fog" in c:
            return 45
        if "overcast" in c or "cloudy" in c:
            return 3
        if "partly" in c:
            return 2
        if "mainly clear" in c:
            return 1
        return 0

    async def _cache(self, data: dict) -> None:
        """Cache environmental data."""
        if not supabase:
            return
        valid_columns = {
            "date", "location_lat", "location_lon", "location_name",
            "uv_index_max", "uv_index_current", "uv_risk_level",
            "aqi", "pm25", "pm10", "aqi_category",
            "pollen_tree", "pollen_grass", "pollen_weed", "pollen_risk_level",
            "temp_c", "humidity", "conditions", "wind_kph",
            "outdoor_exercise_safe", "sunscreen_required", "air_quality_notes",
        }
        filtered = {k: v for k, v in data.items() if k in valid_columns}
        try:
            supabase.table("environmental_data").upsert(filtered, on_conflict="date").execute()
        except Exception as e:
            logger.error(f"Cache write error: {e}")


    async def get_forecast(self, days: int = 5) -> dict:
        """Get daily weather forecast from Open-Meteo (free, no key)."""
        loc = await self._get_user_location()
        if not loc:
            return {"error": "No location configured"}
        lat, lon = loc
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "daily": "weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max",
                        "timezone": "auto",
                        "forecast_days": days,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    daily = data.get("daily", {})
                    dates = daily.get("time", [])
                    forecast = []
                    for i, d in enumerate(dates):
                        forecast.append({
                            "date": d,
                            "weather_code": (daily.get("weather_code") or [])[i] if i < len(daily.get("weather_code") or []) else None,
                            "temp_max": (daily.get("temperature_2m_max") or [])[i] if i < len(daily.get("temperature_2m_max") or []) else None,
                            "temp_min": (daily.get("temperature_2m_min") or [])[i] if i < len(daily.get("temperature_2m_min") or []) else None,
                            "uv_max": (daily.get("uv_index_max") or [])[i] if i < len(daily.get("uv_index_max") or []) else None,
                            "precip_chance": (daily.get("precipitation_probability_max") or [])[i] if i < len(daily.get("precipitation_probability_max") or []) else None,
                        })
                    return {"forecast": forecast}
        except Exception as e:
            logger.error(f"Forecast fetch error: {e}")
        return {"forecast": []}


environment_service = EnvironmentService()
