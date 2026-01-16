import requests
import json
import os
import time
import base64

url = "http://localhost:9010/generate"
# Payload with ONLY a query, triggering the new Deep Research Mode
payload = {
    "input": {
        "query": "The History of Espresso Machines"
    }
}

try:
    print(f"Sending Deep Research request to {url}...")
    # Increase timeout because research takes time!
    response = requests.post(url, json=payload, timeout=120) 
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("Request successful.")
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            print(f"Failed to decode JSON. Raw response: {response.text[:200]}")
            exit(1)
        
        # Check for PDF
        if "pdf" in response_data:
            print(f"Success! PDF generated. Size: {len(response_data['pdf'])} chars")
            # Save it
            try:
                with open("research_output.pdf", "wb") as f:
                    f.write(base64.b64decode(response_data['pdf']))
                print("Saved research_output.pdf")
            except Exception as e:
                print(f"Error saving PDF: {e}")
        
        # Check for JSON data
        if "json" in response_data:
            print("Success! JSON data returned.")
            slides = response_data['json'].get('slides', [])
            print(f"Slides Generated: {len(slides)}")
            if len(slides) > 0:
                print(f"First Slide Title: {slides[0].get('title', 'N/A')}")
            
    else:
        print(f"Request failed: {response.text}")

except Exception as e:
    print(f"Error: {e}")
