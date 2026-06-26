#!/usr/bin/env python3
"""Calorieasy traffic generator — exercises every service in a loop so the
Prometheus metrics and container logs are never empty. Pure stdlib (urllib),
no pip install needed.

Run inside docker-compose (default URLs point at the compose service names):
    docker compose up load-generator
Self-check (no network):
    python loadgen.py --check
Tune rate with LOADGEN_SLEEP (seconds between iterations, default 1.5).
"""
import base64
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone

AUTH = os.getenv("AUTH_URL", "http://auth-service:8081")
MEALS = os.getenv("MEALS_URL", "http://meals-service:8082")
ANALYTICS = os.getenv("ANALYTICS_URL", "http://analytics-service:8083")
SLEEP = float(os.getenv("LOADGEN_SLEEP", "1.5"))

FOODS = ["grilled chicken", "caesar salad", "spaghetti bolognese", "avocado toast",
         "protein shake", "banana", "cheeseburger", "sushi platter", "oatmeal",
         "greek yogurt", "pad thai", "margherita pizza", "burrito bowl", "ramen"]
MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"]
# 1x1 PNG — enough to drive the photo-analyze path (which usually errors without a
# vision model running; that is intentional, it feeds the error panels).
PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


def _req(method, url, *, token=None, body=None, multipart=None):
    headers = {}
    data = None
    if multipart is not None:
        boundary = "----calorieasyLoadGen"
        field, filename, content, ctype = multipart
        parts = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
            f"Content-Type: {ctype}\r\n\r\n"
        ).encode() + content + f"\r\n--{boundary}--\r\n".encode()
        data = parts
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read()
        return resp.status, json.loads(raw) if raw else None


def _meal_body():
    n = random.randint(1, 3)
    items = []
    for _ in range(n):
        cal = random.randint(120, 800)
        items.append({
            "name": random.choice(FOODS),
            "quantity": 1,
            "unit": "serving",
            "calories": cal,
            "proteinGrams": round(cal * 0.08, 1),
            "carbsGrams": round(cal * 0.11, 1),
            "fatGrams": round(cal * 0.04, 1),
            "fiberGrams": round(random.uniform(0, 6), 1),
        })
    return {"mealType": random.choice(MEAL_TYPES), "items": items}


def _goal_body():
    cal = random.randint(1600, 3000)
    return {"dailyCalories": cal, "proteinGrams": round(cal * 0.075, 1),
            "carbsGrams": round(cal * 0.11, 1), "fatGrams": round(cal * 0.035, 1),
            "fiberGrams": 30}


def register():
    n = random.randint(1, 10_000_000)
    email = f"loadgen+{n}@calorieasy.test"
    body = {"email": email, "password": "loadgen-pass-123", "displayName": f"Load User {n}"}
    _, data = _req("POST", f"{AUTH}/api/auth/register", body=body)
    return email, data["accessToken"]


def iteration(users):
    # Grow the user pool; occasionally re-login an existing user.
    if not users or random.random() < 0.3:
        try:
            users.append(register())
        except urllib.error.HTTPError as e:
            print(f"register -> {e.code}", flush=True)
    email, token = random.choice(users)

    # A bad login now and then -> 401 + WARN logs (feeds the auth failure panels).
    if random.random() < 0.15:
        try:
            _req("POST", f"{AUTH}/api/auth/login",
                 body={"email": email, "password": "wrong-password"})
        except urllib.error.HTTPError as e:
            print(f"bad-login -> {e.code}", flush=True)

    today = date.today()
    actions = [
        lambda: _req("POST", f"{MEALS}/api/meals/manual", token=token, body=_meal_body()),
        lambda: _req("GET", f"{MEALS}/api/meals?from={today - timedelta(days=7)}&to={today}", token=token),
        lambda: _req("PUT", f"{ANALYTICS}/api/goals", token=token, body=_goal_body()),
        lambda: _req("GET", f"{ANALYTICS}/api/analytics/daily?date={today}", token=token),
        lambda: _req("GET", f"{ANALYTICS}/api/analytics/weekly?weekStart={today - timedelta(days=today.weekday())}", token=token),
        lambda: _req("GET", f"{ANALYTICS}/api/analytics/streak", token=token),
        lambda: _req("POST", f"{MEALS}/api/meals/estimate", token=token, body={"foodName": random.choice(FOODS)}),
    ]
    if random.random() < 0.2:
        actions.append(lambda: _req(
            "POST", f"{MEALS}/api/meals/analyze", token=token,
            multipart=("image", "meal.png", PNG_1X1, "image/png")))

    for act in random.sample(actions, k=random.randint(2, len(actions))):
        try:
            status, _ = act()
        except urllib.error.HTTPError as e:
            print(f"action -> {e.code}", flush=True)
        except urllib.error.URLError as e:
            print(f"action unreachable: {e.reason}", flush=True)


def main():
    users = []
    print(f"loadgen: auth={AUTH} meals={MEALS} analytics={ANALYTICS} sleep={SLEEP}s", flush=True)
    while True:
        try:
            iteration(users)
        except Exception as e:  # never let the loop die — this is a dev toy
            print(f"iteration error: {e}", flush=True)
        time.sleep(SLEEP)


def _check():
    # Payloads have the exact shapes the backend DTOs require, and multipart
    # framing is well-formed. No network.
    assert set(_meal_body()) == {"mealType", "items"}
    assert set(_goal_body()) == {"dailyCalories", "proteinGrams", "carbsGrams", "fatGrams", "fiberGrams"}
    item = _meal_body()["items"][0]
    assert set(item) >= {"name", "quantity", "unit", "calories", "proteinGrams", "carbsGrams", "fatGrams", "fiberGrams"}
    assert len(PNG_1X1) > 0
    print("loadgen self-check OK")


if __name__ == "__main__":
    if "--check" in sys.argv:
        _check()
    else:
        main()
