import requests
import json

try:
    response = requests.get("http://localhost:8000/api/queue/line/luxuryforbes")
    data = response.json()
    print(json.dumps(data.get("community_goals", []), indent=2))
except Exception as e:
    print(e)
