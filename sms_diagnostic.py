import httpx
import asyncio

async def test_sms_delivery():
    url = "https://www.fast2sms.com/dev/bulkV2"
    # Your verified API Key
    headers = {
        "authorization": "17kdc2DsYNTExSBqpOzRy0j6FCW4V3X98lvoUZuHgawJArIPnQ9zIOm13YxkQqd4jvuhCWSlLbywXEZ0",
        "Content-Type": "application/json"
    }
    
    # ⚠️ CHANGE THIS to your actual mobile number
    test_phone = "9021459660" 
    
    # Testing with 'v3' route which is more stable for ₹50 balance accounts
    payload = {
        "message": "TEST: Bhopal Traffic System API Handshake Successful.",
        "language": "english",
        "route": "v3", 
        "numbers": test_phone
    }

    print(f"🚀 Sending test SMS to {test_phone}...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, headers=headers)
            print(f"--- GATEWAY RESPONSE ---")
            print(response.json())
            print(f"------------------------")
        except Exception as e:
            print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_sms_delivery())