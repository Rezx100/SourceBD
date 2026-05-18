"""
SourceBD — OneProvider Cloud VPS provisioner.

Usage:
    # 1. inventory only (no spend) — pick a plan
    python ops/provision_vps.py inventory

    # 2. provision (will create+pay for a VM!)
    python ops/provision_vps.py create --location-id <ID> --size-id <ID> --template <ID>

    # 3. status of an existing VM
    python ops/provision_vps.py status --vm-id <ID>

    # 4. list our VMs
    python ops/provision_vps.py list
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv


load_dotenv()

API_BASE = os.environ.get("ONEPROVIDER_API_BASE", "https://api.oneprovider.com").rstrip("/")
API_KEY = os.environ.get("ONEPROVIDER_API_KEY")
CLIENT_KEY = os.environ.get("ONEPROVIDER_CLIENT_KEY")
PUB_KEY_PATH = Path(os.path.expanduser("~/.ssh/sourcebd_vps.pub"))

if not (API_KEY and CLIENT_KEY):
    sys.exit("ERROR: ONEPROVIDER_API_KEY and ONEPROVIDER_CLIENT_KEY must be set in .env")

HEADERS = {
    "Api-Key": API_KEY,
    "Client-Key": CLIENT_KEY,
    "User-Agent": "OneApi/1.0 SourceBD-Provisioner",
}


def call(method: str, path: str, *, params: dict | None = None, data: dict | None = None) -> dict:
    url = f"{API_BASE}{path}"
    with httpx.Client(timeout=60, headers=HEADERS) as c:
        r = c.request(method, url, params=params, data=data)
    if r.status_code != 200:
        try:
            body = r.json()
        except Exception:
            body = r.text
        raise RuntimeError(f"{method} {path} -> HTTP {r.status_code}: {body}")
    return r.json()


# -------- inventory --------

def _unwrap(d):
    if isinstance(d, dict) and "response" in d:
        return d["response"]
    return d


def inventory() -> None:
    print("\n=== /vm/locations ===")
    locs = _unwrap(call("GET", "/vm/locations"))
    print(json.dumps(locs, indent=2)[:12000])

    print("\n=== /vm/templates (Ubuntu only) ===")
    tpls = _unwrap(call("GET", "/vm/templates"))
    if isinstance(tpls, list):
        ubuntu = [t for t in tpls if "ubuntu" in json.dumps(t).lower()]
        for t in ubuntu:
            print(f"  id={t.get('id'):<6} {t.get('name')}")
    else:
        print(json.dumps(tpls, indent=2)[:4000])

    print("\n=== /vm/sizes (cores>=4, ram>=8GB) ===")
    sizes = _unwrap(call("GET", "/vm/sizes"))
    if isinstance(sizes, list):
        for s in sizes:
            try:
                cores = int(s.get("cores", 0)); ram = int(s.get("ram", 0))
            except Exception:
                cores = ram = 0
            if cores >= 4 and ram >= 8192:
                print(f"  id={s.get('id'):<6} {s.get('name'):<22} type={s.get('type'):<18} cores={cores} ram={ram}MB hdd={s.get('hdd')}GB ipv4={s.get('ipv4')} ${s.get('monthly_price')}/mo (${s.get('hourly_price')}/hr)")


# -------- create --------

def create(location_id: int, size_id: int, template: str, hostname: str) -> None:
    if not PUB_KEY_PATH.exists():
        sys.exit(f"Missing public key at {PUB_KEY_PATH}")
    pub = PUB_KEY_PATH.read_text(encoding="utf-8").strip()

    payload = {
        "location_id": location_id,
        "instance_size": size_id,
        "template": template,
        "hostname": hostname,
        "sshKeySingleUse": pub,
        "enable_ipv6": "true",
    }
    print("POST /vm/create payload:")
    safe = dict(payload); safe["sshKeySingleUse"] = pub[:40] + "..."
    print(json.dumps(safe, indent=2))
    print("\nProceed? Type YES to charge balance and create VM:")
    if input("> ").strip() != "YES":
        sys.exit("Aborted.")

    res = call("POST", "/vm/create", data=payload)
    print("\nCreate response:")
    print(json.dumps(res, indent=2))

    vm_id = (res.get("vm") or {}).get("id") or res.get("vm_id") or res.get("id")
    if not vm_id:
        sys.exit("Could not extract vm_id from response. Inspect above and call status manually.")

    print(f"\nVM ID: {vm_id} — polling for provisioning...")
    poll(vm_id)


def poll(vm_id: int, max_wait: int = 1200) -> None:
    start = time.time()
    while time.time() - start < max_wait:
        try:
            info = call("GET", f"/vm/info/{vm_id}")
        except Exception as e:
            print(f"  status check failed: {e}")
            time.sleep(15)
            continue
        vm = info.get("vm") or info
        status = vm.get("status") or vm.get("state") or "?"
        ip = vm.get("ip") or vm.get("primary_ip") or (vm.get("ipv4") or [None])[0]
        print(f"  [{int(time.time()-start)}s] status={status} ip={ip}")
        if ip and str(status).lower() in ("running", "active", "online", "started"):
            print(f"\nREADY. SSH: ssh -i ~/.ssh/sourcebd_vps root@{ip}")
            return
        time.sleep(20)
    print("Timeout. Check OnePanel manually.")


def status(vm_id: int) -> None:
    info = call("GET", f"/vm/info/{vm_id}")
    print(json.dumps(info, indent=2)[:8000])


def list_vms() -> None:
    res = call("GET", "/vm/listing/")
    print(json.dumps(res, indent=2)[:8000])


# -------- cli --------

def main() -> None:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("inventory")
    c = sub.add_parser("create")
    c.add_argument("--location-id", type=int, required=True)
    c.add_argument("--size-id", type=int, required=True)
    c.add_argument("--template", required=True)
    c.add_argument("--hostname", default="sourcebd-etl-01")
    s = sub.add_parser("status"); s.add_argument("--vm-id", type=int, required=True)
    sub.add_parser("list")
    pl = sub.add_parser("poll"); pl.add_argument("--vm-id", type=int, required=True)
    args = p.parse_args()

    if args.cmd == "inventory": inventory()
    elif args.cmd == "create": create(args.location_id, args.size_id, args.template, args.hostname)
    elif args.cmd == "status": status(args.vm_id)
    elif args.cmd == "list": list_vms()
    elif args.cmd == "poll": poll(args.vm_id)


if __name__ == "__main__":
    main()
