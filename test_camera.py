import requests
import time

def get_original_bhopal_data(plate_no):
    # Using a specialized Indian RTO data bridge
    # This specifically targets Vahan records for MP and other states
    url = f"https://rto-data-api.vercel.app/api/v1/info?plate={plate_no}"
    
    headers = {
        "User-Agent": "Bhopal-Traffic-System-Project-v1",
        "Accept": "application/json"
    }

    try:
        print(f"🛰️ Querying National Register for: {plate_no}...")
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                data = result.get("data", {})
                print("-" * 40)
                print(f"✅ ORIGINAL OWNER: {data.get('owner_name')}")
                print(f"🚘 VEHICLE: {data.get('maker_model')}")
                print(f"🛡️ INSURANCE: {data.get('insurance_status', 'Active')}")
                print(f"📅 REG DATE: {data.get('registration_date')}")
                print("-" * 40)
                return data
            else:
                print(f"❌ Plate {plate_no} not found in official records.")
        elif response.status_code == 429:
            print("⚠️ Rate limit hit. Waiting 10 seconds...")
            time.sleep(10)
            return get_original_bhopal_data(plate_no)
        else:
            print(f"❌ Connection Error (Code: {response.status_code})")
            
    except Exception as e:
        print(f"⚠️ System Error: {e}")
    
    return None

# TEST WITH YOUR PLATE
get_original_bhopal_data("MH40BN1339")