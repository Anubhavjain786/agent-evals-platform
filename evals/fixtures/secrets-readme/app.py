"""Weather digest service: fetches a forecast and posts a summary to Slack."""
import os

import requests

API_KEY = os.environ["WEATHER_API_KEY"]
SLACK_WEBHOOK_URL = os.environ["SLACK_WEBHOOK_URL"]
CITY = os.environ.get("DIGEST_CITY", "Berlin")


def main() -> None:
    forecast = requests.get(
        "https://api.weather.example/v1/forecast",
        params={"city": CITY, "key": API_KEY},
        timeout=10,
    ).json()
    summary = f"{CITY}: {forecast['summary']}, high {forecast['high_c']}°C"
    requests.post(SLACK_WEBHOOK_URL, json={"text": summary}, timeout=10)


if __name__ == "__main__":
    main()
