"""Inspect what location data RSC API returns and where else address might live."""
import httpx, json

r = httpx.get(
    "https://accord2.fairfactories.org/api/v1/factories",
    params={"status":"active,inactive,no brand,pending closure,ineligible",
            "progress":"0,1,2,3,4,5,6,7,8,9","language":"en","format":"json","limit":5,"page":1},
    timeout=30,
).json()

print("=== top-level response keys ===")
print(list(r.keys()))
data_key = "data" if "data" in r else next(iter(k for k in r if isinstance(r[k], list)), None)
print(f"data key: {data_key}")
print()
print("=== first 3 records ===")
for f in r[data_key][:3]:
    print(json.dumps(f, indent=2)[:2000])
    print("---")

# Try the detail endpoint
fid = r[data_key][0].get("id") or r[data_key][0].get("factory_id")
print(f"\n=== /factory/{fid} ===")
try:
    d = httpx.get(f"https://accord2.fairfactories.org/api/v1/factory/{fid}",
                  params={"language":"en","format":"json"}, timeout=30).json()
    print(json.dumps(d, indent=2)[:3000])
except Exception as e:
    print(f"detail: {e}")
