import urllib.request
import urllib.error
import json

url = "http://localhost:8000/api/queue/line/AlgorithMikely"

try:
    with urllib.request.urlopen(url) as response:
        print(f"Status: {response.status}")
        data = response.read().decode('utf-8')
        try:
            json_data = json.loads(data)
            print("Response is valid JSON.")
            # print(json.dumps(json_data, indent=2)) # Too long
        except json.JSONDecodeError:
            print("Response is NOT valid JSON.")
            print(data[:500])
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
