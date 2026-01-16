import requests
import json
import os
import time

url = "http://localhost:9010/generate"
payload = {
    "input": {
        "title": "Standalone Test",
        "slides": [
            {
                "title": "Debug Slide",
                "findings": "This is a test to verify PDF generation logic. The slide should contain this text."
            }
        ]
    }
}

try:
    print(f"Sending request to {url}...")
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text[:200]}...")
    
    if response.status_code == 200:
        print("Request successful.")
        # Check for PDF file
        if os.path.exists("debug_output.pdf"):
            size = os.path.getsize("debug_output.pdf")
            print(f"Found debug_output.pdf (Size: {size} bytes)")
        else:
            print("debug_output.pdf NOT found.")

        if os.path.exists("debug_output.json"):
            size = os.path.getsize("debug_output.json")
            print(f"Found debug_output.json (Size: {size} bytes)")
        else:
            print("debug_output.json NOT found.")
    else:
        print("Request failed.")

except Exception as e:
    print(f"Error: {e}")
