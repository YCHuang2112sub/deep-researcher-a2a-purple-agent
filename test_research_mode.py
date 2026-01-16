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
            data = response.json()
        except json.JSONDecodeError:
            print(f"Failed to decode JSON. Raw response: {response.text[:200]}")
            exit(1)
        
        if 'pdf' in data:
            pdf_data = data['pdf']
            print(f"Success! PDF generated. Size: {len(pdf_data)} chars")
            
            # Save PDF
            try:
                with open('research_output.pdf', 'wb') as f:
                    f.write(base64.b64decode(pdf_data))
                print("Saved research_output.pdf")
            except Exception as e:
                print(f"Error saving PDF: {e}")
        
        if 'json' in data:
            json_data = data['json']
            print("Success! JSON data returned.")
            
            # Save JSON
            try:
                with open('research_output.json', 'w', encoding='utf-8') as f:
                    json.dump(json_data, f, indent=2, ensure_ascii=False)
                print("Saved research_output.json")
            except Exception as e:
                print(f"Error saving JSON: {e}")
            
            print(f"Slides Generated: {len(json_data.get('slides', []))}")
            if json_data.get('slides'):
                print(f"First Slide Title: {json_data['slides'][0].get('title', 'Unknown')}")
            
    else:
        print(f"Request failed: {response.text}")

except Exception as e:
    print(f"Error: {e}")
