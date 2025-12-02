import requests

try:
    # Direct backend access (assuming port 8000 is mapped to host 8000 based on previous logs showing uvicorn on 8000)
    # Wait, docker-compose usually maps ports. Let's assume localhost:8000 is accessible.
    # If not, I'll use the internal network if I could, but I can't run inside container easily.
    # The user logs showed "Uvicorn running on http://0.0.0.0:8000", and vite proxy targets localhost:8000.
    
    url = "http://localhost:8000/api/spotlight"
    print(f"Testing {url}...")
    response = requests.get(url, allow_redirects=False)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 307:
        print(f"Redirect Location: {response.headers.get('Location')}")
    elif response.status_code == 200:
        print("Success: 200 OK")
    else:
        print(f"Unexpected status: {response.status_code}")

except Exception as e:
    print(f"Error: {e}")
