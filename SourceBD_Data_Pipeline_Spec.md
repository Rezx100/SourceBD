# SourceBD — Data Pipeline & Database Enrichment Spec
**Version 1.0 · Comprehensive source inventory, scraping strategy, deduplication logic, and enterprise enrichment roadmap**

---

## 1. SOURCE INVENTORY & TRUST HIERARCHY

Before writing a single line of scraping code, establish a source trust hierarchy. This controls how conflicts are resolved when the same company appears in multiple sources with conflicting data.

```
TIER 1 — Primary Government / Regulatory (highest trust, overrides everything)
  RSC (rsc-bd.org)                   Fire & structural remediation — most critical
  RJSC (rjsc.gov.bd)                 Company legal registration
  DIFE (dife.gov.bd)                 Factory inspection violations
  EPB (epb.gov.bd)                   Export registration certificates (ERC)
  BEPZA (bepza.gov.bd)               Export processing zone registrations

TIER 2 — Industry Authority Registers
  BGMEA member register              Garment sector — buying houses + factories
  BKMEA member register              Knitwear sector — factories + some buying houses
  BGAPMEA register                   Accessories & packaging

TIER 3 — International Certification Bodies (verifiable portals)
  WRAP (wrapcompliance.org)          WRAP certified facilities list
  amfori / BSCI (amfori.org)        BSCI audit database
  OEKO-TEX (oeko-tex.com)           Certified facility search
  GOTS (global-standard.org)        GOTS certified entities
  Fair Trade (flocert.net)           FLO-CERT producer database
  GRS / RCS (textileexchange.org)   Recycled content certification
  Better Cotton (bettercotton.org)  BCI member list

TIER 4 — Brand Public Supplier Disclosures (US, UK, EU law-driven)
  H&M Group supplier list
  Marks & Spencer ethical trading
  PVH Corp supplier factory list
  Patagonia supply chain transparency
  Nike Manufacturing Map
  Gap Inc. approved factory list
  Target supplier factory list
  Walmart (Walmart ESG report supplier data)
  Adidas group supplier map
  Primark supplier list
  Next PLC supplier list (UK MSA obligation)
  Burberry modern slavery statement
  ASOS supplier list

TIER 5 — US/UK/EU Regulatory Databases (compliance intelligence)
  US CBP UFLPA Entity List
  US CBP Withhold Release Orders (WRO)
  US OFAC SDN List
  UK OFSI Consolidated Sanctions List
  EU Sanctions Map (sanctionsmap.eu)
  US Dept of Labor ILAB TVPRA List
  UK Modern Slavery Registry (modern-slavery.homeoffice.gov.uk)
  US SEC EDGAR supply chain disclosures

TIER 6 — Cross-check only (NOT primary source — verify before importing)
  Exporter list PDFs from non-government websites   ← YOUR DOWNLOADED FILE
  Third-party directories (Kompass, Dun & Bradstreet, etc.)
  LinkedIn company pages
```

---

## 2. BGMEA BUYING HOUSE PDF — PARSING STRATEGY

You have the BGMEA Associate Member (Buying House) PDF with ~1,759 records across 84 pages.

### 2.1 Parse approach

The PDF is structured as plain text with consistent patterns per entry. Use `pdfplumber` (not PyPDF2 — pdfplumber handles multi-column and whitespace better).

```python
# scripts/import/parse_bgmea_buying_houses.py
import pdfplumber
import re
import json
import unicodedata
from slugify import slugify

def parse_bgmea_pdf(pdf_path: str) -> list[dict]:
    """
    Parse BGMEA Associate Member (Buying House) list PDF.
    Each entry follows the pattern:
      Company Name (Reg: NNN)
      Contact Name
      Role (MD / Proprietor / Chairman / etc.)
      Address line 1
      Area, City
      Tel: XXXXXXXXX
      Email: xxx@xxx.com
    """
    entries = []
    raw_text = ""

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            raw_text += page.extract_text() + "\n"

    # Split on registration number pattern — this is the reliable anchor
    # Pattern: "Company Name (Reg: NNN)"
    entry_pattern = re.compile(
        r'(.+?)\s*\(Reg:\s*(\d+)\)\s*\n'  # company name + reg number
        r'(.+?)\s*\n'                        # contact name
        r'(.+?)\s*\n'                        # role/title
        r'(.+?)\n'                           # address line 1
        r'(.+?),?\s*(?:Dhaka|Chittagong|Gazipur|Narayangonj|Khulna|Rajshahi)\s*\n'  # area, city
        r'Tel:\s*([^\n]+)\n'                 # telephone
        r'(?:Email:\s*([^\n]+)\n)?',         # email (optional)
        re.MULTILINE | re.DOTALL
    )

    for match in entry_pattern.finditer(raw_text):
        company_name = match.group(1).strip()
        reg_number = match.group(2).strip()
        contact_name = match.group(3).strip()
        role = match.group(4).strip()
        address_1 = match.group(5).strip()
        area_city = match.group(6).strip()
        tel = match.group(7).strip()
        email = match.group(8).strip() if match.group(8) else None

        entries.append({
            "company_name": company_name,
            "bgmea_reg_number": reg_number,
            "entity_type": "buying_house",
            "source": "BGMEA_ASSOCIATE_MEMBERS",
            "contact_name": contact_name,
            "contact_role": role,
            "address_raw": f"{address_1}, {area_city}",
            "phone_raw": tel,
            "email": email.lower() if email else None,
            "slug": slugify(company_name),
        })

    return entries


def normalize_phone(raw: str) -> list[str]:
    """Extract individual phone numbers from messy comma/space-separated strings."""
    # Remove country codes, clean separators
    phones = re.split(r'[,\s]+', raw)
    cleaned = []
    for p in phones:
        p = p.strip().replace('-', '').replace(' ', '')
        if len(p) >= 7:
            if not p.startswith('+'):
                if p.startswith('01') and len(p) == 11:
                    p = '+880' + p[1:]  # BD mobile
                elif p.startswith('02') or p.startswith('031'):
                    p = '+880' + p[1:]  # BD landline
            cleaned.append(p)
    return cleaned


def detect_city(address: str) -> str:
    cities = {
        'Dhaka': ['Dhaka', 'DOHS', 'Uttara', 'Gulshan', 'Banani', 'Dhanmondi',
                  'Mirpur', 'Mohakhali', 'Tejgaon', 'Malibagh', 'Rampura',
                  'Savar', 'Gazipur', 'Ashulia', 'Narayanganj', 'Keraniganj'],
        'Chittagong': ['Chittagong', 'Agrabad', 'Nasirabad', 'Panchlaish',
                       'Halishahar', 'Pahartali', 'Kalurghat', 'Muradpur'],
        'Khulna': ['Khulna'],
        'Rajshahi': ['Rajshahi'],
        'Sylhet': ['Sylhet'],
    }
    for city, keywords in cities.items():
        if any(k.lower() in address.lower() for k in keywords):
            return city
    return 'Dhaka'  # default


if __name__ == "__main__":
    results = parse_bgmea_pdf("data/raw/BGMEA_Associate_Members.pdf")
    with open("data/parsed/bgmea_buying_houses.json", "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Parsed {len(results)} buying house entries from BGMEA PDF")
```

### 2.2 Known parsing challenges with this PDF

From reviewing the actual document:

- **Inconsistent line breaks**: Some addresses wrap across 3–4 lines. Use reg number as the reliable entry anchor rather than parsing line-by-line.
- **Tel field chaos**: Multiple numbers in one field, separated by commas, spaces, or nothing. See `normalize_phone()` above.
- **Missing emails**: ~15% of entries have no email. Don't treat this as invalid — it's common for older BGMEA registrations.
- **Same company, multiple registrations**: Some companies appear under slightly different names with different reg numbers (see "ABL" appearing twice with Reg 395 and 879). The deduplication logic in Section 4 handles this.
- **Chittagong addresses**: These use different area names. The regex above needs extended city detection.
- **Korean/Chinese MDs**: Some entries have non-Latin names for the MD (foreign-invested buying houses). Handle Unicode carefully.

### 2.3 Batch insert to Supabase

```typescript
// src/scripts/importBgmeaBuyingHouses.ts
import { createClient } from '@supabase/supabase-js'
import { slugify } from '@/lib/utils/slugify'
import bgmeaData from '../../data/parsed/bgmea_buying_houses.json'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

async function importBuyingHouses() {
  const batches = chunk(bgmeaData, 100) // Supabase recommends ≤100 per upsert
  let imported = 0
  let skipped = 0

  for (const batch of batches) {
    const rows = batch.map(entry => ({
      company_name:        entry.company_name,
      slug:                entry.slug,
      entity_type:         'buying_house' as const,
      bgmea_reg_number:    entry.bgmea_reg_number,
      bgmea_verified:      true,
      contact_name:        entry.contact_name,
      contact_role:        entry.contact_role,
      address_raw:         entry.address_raw,
      city:                detectCity(entry.address_raw),
      phone_primary:       entry.phones?.[0] ?? null,
      email_primary:       entry.email ?? null,
      source_tags:         ['BGMEA'],
      sbi_score:           0,        // calculated after data enrichment
      is_active:           true,
      claimed_by:          null,
    }))

    const { error, count } = await supabase
      .from('suppliers')
      .upsert(rows, {
        onConflict: 'slug',         // slug is unique — deduplicates on reimport
        ignoreDuplicates: false,    // update if exists (in case reg number changed)
        count: 'exact',
      })

    if (error) {
      console.error('Batch error:', error.message, batch[0].company_name)
      skipped += batch.length
    } else {
      imported += count ?? 0
    }
  }

  console.log(`Imported: ${imported} | Skipped/errored: ${skipped}`)
}

importBuyingHouses()
```

---

## 3. BKMEA WEBSITE SCRAPING

**BKMEA = Bangladesh Knitwear Manufacturers and Exporters Association**
**URL**: https://member.bkmea.com/member-home

BKMEA was completely missing from the original spec. This is critical — Bangladesh is the world's second-largest knitwear exporter, and BKMEA members are the factories you most need in the database.

### 3.1 Reconnaissance first

Before writing scraper code, inspect the site manually:

```bash
# Step 1: Check robots.txt
curl https://member.bkmea.com/robots.txt

# Step 2: Check if it's server-rendered or client-rendered
curl -s https://member.bkmea.com/member-home | grep -i "react\|vue\|angular\|next"

# Step 3: Check for public API endpoints in network tab
# Open DevTools → Network → XHR/Fetch → reload page
# Look for /api/ calls that return JSON
```

### 3.2 Scraper (handle both static HTML and JS-rendered pages)

```python
# scripts/import/scrape_bkmea.py
import requests
from bs4 import BeautifulSoup
import time
import json
import random
from playwright.sync_api import sync_playwright  # for JS-rendered fallback

BKMEA_BASE = "https://member.bkmea.com"
BKMEA_MEMBER_LIST = f"{BKMEA_BASE}/member-home"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SourceBD-Research/1.0; +https://sourcebd.com/data-policy)",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def scrape_bkmea_static() -> list[dict]:
    """Try static HTML scraping first — faster and lighter."""
    members = []
    page = 1

    while True:
        try:
            url = f"{BKMEA_MEMBER_LIST}?page={page}"
            resp = requests.get(url, headers=HEADERS, timeout=30)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "lxml")

            # Adjust these selectors after inspecting the actual DOM
            member_cards = soup.select(".member-card, .company-item, tr.member-row")

            if not member_cards:
                print(f"No more members at page {page}")
                break

            for card in member_cards:
                # Extract — adjust field selectors to match actual HTML
                name = card.select_one(".company-name, .member-name, td:nth-child(1)")
                reg  = card.select_one(".reg-number, .bkmea-id, td:nth-child(2)")
                addr = card.select_one(".address, td:nth-child(3)")
                tel  = card.select_one(".phone, .tel, td:nth-child(4)")
                email= card.select_one(".email, td:nth-child(5)")
                cat  = card.select_one(".category, .product-type")  # knitwear subcategory

                if name:
                    members.append({
                        "company_name":     name.get_text(strip=True),
                        "bkmea_reg_number": reg.get_text(strip=True) if reg else None,
                        "entity_type":      "factory",  # BKMEA = manufacturers
                        "source":           "BKMEA",
                        "address_raw":      addr.get_text(strip=True) if addr else None,
                        "phone_raw":        tel.get_text(strip=True) if tel else None,
                        "email":            email.get_text(strip=True) if email else None,
                        "product_categories": ["knitwear"],  # all BKMEA = knitwear
                        "bkmea_subcategory": cat.get_text(strip=True) if cat else None,
                    })

            page += 1
            time.sleep(random.uniform(1.5, 3.0))  # respectful rate limiting

        except Exception as e:
            print(f"Error at page {page}: {e}")
            break

    return members


def scrape_bkmea_playwright() -> list[dict]:
    """Fallback for JS-rendered content."""
    members = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page_obj = browser.new_page()
        page_obj.set_extra_http_headers(HEADERS)

        # Intercept API calls to capture raw JSON
        api_responses = []
        def handle_response(response):
            if "api" in response.url or "member" in response.url:
                try:
                    data = response.json()
                    api_responses.append(data)
                except:
                    pass

        page_obj.on("response", handle_response)
        page_obj.goto(BKMEA_MEMBER_LIST, wait_until="networkidle", timeout=60000)

        # If API responses captured, parse those (cleaner)
        if api_responses:
            for resp_data in api_responses:
                # Handle common API response shapes
                items = resp_data.get("data", resp_data.get("members", resp_data.get("results", [])))
                for item in items:
                    members.append({
                        "company_name": item.get("name") or item.get("company_name"),
                        "bkmea_reg_number": str(item.get("id") or item.get("reg_no", "")),
                        "entity_type": "factory",
                        "source": "BKMEA",
                        "address_raw": item.get("address"),
                        "phone_raw": item.get("phone") or item.get("tel"),
                        "email": item.get("email"),
                        "product_categories": ["knitwear"],
                    })
        else:
            # Fall back to DOM scraping after JS render
            content = page_obj.content()
            soup = BeautifulSoup(content, "lxml")
            # Use same selectors as static approach above
            # ...

        browser.close()

    return members


if __name__ == "__main__":
    print("Attempting static scrape...")
    members = scrape_bkmea_static()

    if not members:
        print("Static scrape empty — trying Playwright...")
        members = scrape_bkmea_playwright()

    with open("data/parsed/bkmea_members.json", "w", encoding="utf-8") as f:
        json.dump(members, f, indent=2, ensure_ascii=False)

    print(f"Scraped {len(members)} BKMEA members")
```

### 3.3 Rate limiting + ethics

```python
# Scraping policy for BKMEA:
# - Max 1 request per 2 seconds
# - Only scrape between 01:00–05:00 UTC (off-peak for Bangladesh servers)
# - Identify yourself in User-Agent
# - Respect 429 responses with exponential backoff
# - Cache full scrape and only re-scrape weekly (not daily)
# - If BKMEA contacts you about scraping, respond professionally and offer
#   to partner officially — they will likely welcome the visibility
```

---

## 4. DEDUPLICATION LOGIC

This is the most complex part. Three scenarios:

```
Scenario A: Company appears in BGMEA only
  → source_tags = ['BGMEA']
  → bgmea_verified = true, bkmea_verified = false

Scenario B: Company appears in BKMEA only
  → source_tags = ['BKMEA']
  → bgmea_verified = false, bkmea_verified = true

Scenario C: Same company appears in BOTH BGMEA and BKMEA
  → source_tags = ['BGMEA', 'BKMEA']  ← show BOTH tags
  → bgmea_verified = true, bkmea_verified = true
  → DO NOT merge or pick one — show both affiliations
  → This is POSITIVE signal — dual membership = higher credibility
```

### 4.1 Database schema additions

```sql
-- Add to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bgmea_reg_number   TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bgmea_verified     BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bkmea_reg_number   TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bkmea_verified     BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bgapmea_verified   BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS source_tags        TEXT[] DEFAULT '{}';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS epb_erc_number     TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rjsc_reg_number    TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bepza_zone         TEXT;  -- EPZ membership

-- Index for deduplication queries
CREATE INDEX IF NOT EXISTS idx_suppliers_bgmea_reg ON suppliers(bgmea_reg_number);
CREATE INDEX IF NOT EXISTS idx_suppliers_bkmea_reg ON suppliers(bkmea_reg_number);
CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm ON suppliers USING gin(company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email_primary);
```

### 4.2 Matching algorithm

```python
# scripts/dedup/match_and_merge.py
"""
Multi-pass deduplication:
Pass 1: Exact slug match (normalised company name)
Pass 2: Exact email match
Pass 3: Exact phone match
Pass 4: Fuzzy name match (threshold 92%)
Pass 5: Address similarity (for companies with no email/phone)
Manual queue: anything below 85% confidence flagged for human review
"""

from rapidfuzz import fuzz, process
from slugify import slugify
import re


def normalize_company_name(name: str) -> str:
    """Normalise for matching — strip legal suffixes, punctuation, etc."""
    name = name.lower().strip()
    # Remove common legal suffixes
    suffixes = [
        r'\s+(ltd\.?|limited|pvt\.?|private|co\.?|corp\.?|corporation|'
        r'inc\.?|llc|llp|group|international|sourcing|fashion|apparels?|'
        r'bd|bangladesh|textile|garment|knitwear|export|import|trading|'
        r'enterprises?|associates?|services?)\.?\s*$'
    ]
    for suffix in suffixes:
        name = re.sub(suffix, '', name, flags=re.IGNORECASE).strip()
    return name.strip()


def find_duplicate(
    new_company: dict,
    existing_db: list[dict],
    threshold: float = 0.92
) -> dict | None:
    """
    Return existing record if match found, else None.
    Does NOT auto-merge — returns the match for human confirmation if fuzzy.
    """
    new_slug = slugify(new_company['company_name'])
    new_email = (new_company.get('email') or '').lower().strip()
    new_phones = extract_phones(new_company.get('phone_raw', ''))
    new_norm = normalize_company_name(new_company['company_name'])

    for existing in existing_db:
        # Pass 1: Exact slug
        if existing['slug'] == new_slug:
            return {'match': existing, 'confidence': 1.0, 'method': 'slug'}

        # Pass 2: Exact email
        if new_email and new_email == existing.get('email_primary', '').lower():
            return {'match': existing, 'confidence': 1.0, 'method': 'email'}

        # Pass 3: Phone overlap
        existing_phones = extract_phones(existing.get('phone_raw', ''))
        if new_phones and existing_phones:
            overlap = set(new_phones) & set(existing_phones)
            if overlap:
                return {'match': existing, 'confidence': 0.95, 'method': 'phone'}

        # Pass 4: Fuzzy name
        existing_norm = normalize_company_name(existing['company_name'])
        score = fuzz.token_sort_ratio(new_norm, existing_norm) / 100
        if score >= threshold:
            return {'match': existing, 'confidence': score, 'method': 'fuzzy_name'}

    return None  # No match — this is a new company


def merge_sources(existing: dict, new_record: dict) -> dict:
    """
    Merge data from new source into existing record.
    Rules:
    - Always ADD source_tags (never remove)
    - Higher-tier source data overrides lower-tier for same field
    - Never overwrite non-null with null
    """
    merged = existing.copy()

    # Add source tag
    new_tag = new_record.get('source')
    if new_tag and new_tag not in merged.get('source_tags', []):
        merged['source_tags'] = merged.get('source_tags', []) + [new_tag]

    # Update BKMEA-specific fields
    if new_record.get('source') == 'BKMEA':
        merged['bkmea_verified'] = True
        merged['bkmea_reg_number'] = new_record.get('bkmea_reg_number')
        if not merged.get('entity_type') or merged['entity_type'] == 'unknown':
            merged['entity_type'] = 'factory'  # BKMEA = manufacturer

    # Fill blanks (never overwrite existing data with nulls)
    for field in ['email_primary', 'phone_primary', 'address_raw', 'contact_name']:
        if not merged.get(field) and new_record.get(field):
            merged[field] = new_record[field]

    return merged
```

### 4.3 Within-BGMEA deduplication

BGMEA itself has duplicates in the PDF (same company with two registrations, or company renamed). Apply this FIRST before cross-source merging:

```python
def dedup_within_bgmea(entries: list[dict]) -> list[dict]:
    """
    Deduplicate within BGMEA list.
    Policy: Keep BOTH registration numbers, merge data.
    Example: "ABL (Reg: 395)" and "ABL (Reg: 879)" → one record with both reg numbers.
    """
    seen = {}
    for entry in entries:
        slug = slugify(entry['company_name'])
        if slug in seen:
            # Same company — add second reg number to array field
            existing = seen[slug]
            existing['bgmea_reg_numbers'] = list(set(
                existing.get('bgmea_reg_numbers', [existing.get('bgmea_reg_number')]) +
                [entry['bgmea_reg_number']]
            ))
            # Fill any missing fields
            for field in ['email', 'phone_raw', 'address_raw', 'contact_name']:
                if not existing.get(field) and entry.get(field):
                    existing[field] = entry[field]
        else:
            entry['bgmea_reg_numbers'] = [entry['bgmea_reg_number']]
            seen[slug] = entry

    return list(seen.values())
```

---

## 5. EXPORTER LIST PDF — CROSS-CHECK STRATEGY

The Exporter List PDF you downloaded from a non-government website is **Tier 6** (cross-check only). The verification procedure before importing ANY record from it:

```
For each company in the exporter PDF:
  Step 1 → Does it appear in BGMEA PDF?       → If YES: safe, use BGMEA data
  Step 2 → Does it appear in BKMEA website?   → If YES: safe, use BKMEA data
  Step 3 → Does it appear in RSC database?    → If YES: safe, add RSC data
  Step 4 → Does it appear in EPB/ERC database?→ If YES: can be imported
  Step 5 → NOT in any authoritative source?   → DO NOT IMPORT. Queue for manual review.
```

### 5.1 Why this matters

Non-government exporter lists often contain:
- Companies that have closed
- Companies with wrong contact details (outdated)
- Shell companies or duplicate entries
- Companies from OTHER countries mislabelled
- Legitimate companies with incorrect compliance data

**Policy: Zero records from the exporter PDF enter the database unless corroborated by at least one Tier 1–3 source.**

### 5.2 Automated cross-check script

```python
# scripts/dedup/crosscheck_exporter_list.py

def crosscheck_exporter(
    exporter_entry: dict,
    bgmea_db: list[dict],
    bkmea_db: list[dict],
    rsc_db: list[dict],
) -> dict:
    """
    Returns enriched entry if corroborated, else rejection reason.
    """
    result = {
        "company_name": exporter_entry["company_name"],
        "status": "pending",
        "corroborated_by": [],
        "action": None,
    }

    # Check each authoritative source
    bgmea_match = find_duplicate(exporter_entry, bgmea_db)
    bkmea_match  = find_duplicate(exporter_entry, bkmea_db)
    rsc_match    = find_duplicate(exporter_entry, rsc_db)

    if bgmea_match:
        result["corroborated_by"].append(f"BGMEA ({bgmea_match['match']['bgmea_reg_number']})")
    if bkmea_match:
        result["corroborated_by"].append(f"BKMEA ({bkmea_match['match']['bkmea_reg_number']})")
    if rsc_match:
        result["corroborated_by"].append(f"RSC ({rsc_match['match']['rsc_id']})")

    if result["corroborated_by"]:
        result["status"] = "approved"
        result["action"] = "enrich_existing_record"  # Don't create new — just enrich
    else:
        result["status"] = "rejected"
        result["action"] = "manual_review_queue"

    return result
```

---

## 6. RSC DATABASE — ALL 1,928 FACTORIES

This is the single most valuable compliance dataset. The RSC (RMG Sustainability Council) database at **rsc-bd.org/factories/** has the fire safety and structural remediation status for every factory that was inspected under the Accord/Alliance framework.

**Every single factory in the database must be checked against RSC.**

### 6.1 RSC data structure (from the website)

Each factory entry on rsc-bd.org contains:
- Factory name
- Factory ID (internal RSC identifier)
- Location (district/area)
- Fire safety status: % complete
- Structural safety status: % complete
- Electrical safety status: % complete
- Last inspection date
- Active/inactive status

### 6.2 RSC scraper

```python
# scripts/import/scrape_rsc.py
import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json
import time

RSC_BASE = "https://rsc-bd.org"
RSC_FACTORIES = f"{RSC_BASE}/factories/"

def scrape_rsc_factories() -> list[dict]:
    """
    RSC uses React/SPA, so we need Playwright.
    Expected: ~1,928 factory records.
    """
    factories = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Intercept API calls — RSC likely has a JSON API
        api_data = []
        def on_response(response):
            if response.status == 200:
                ct = response.headers.get("content-type", "")
                if "json" in ct and "factories" in response.url:
                    try:
                        api_data.append(response.json())
                    except:
                        pass

        page.on("response", on_response)

        # Load with search empty to get all
        page.goto(RSC_FACTORIES, wait_until="networkidle", timeout=90000)

        # Check if pagination exists
        # RSC may paginate — detect and loop
        current_page = 1
        while True:
            time.sleep(2)  # Wait for content

            if api_data:
                # Parse from intercepted API (preferred)
                for resp in api_data:
                    if isinstance(resp, list):
                        factories.extend(resp)
                    elif isinstance(resp, dict):
                        data = resp.get("data", resp.get("factories", resp.get("results", [])))
                        factories.extend(data)
                api_data.clear()
            else:
                # Parse from DOM
                content = page.content()
                soup = BeautifulSoup(content, "lxml")
                rows = soup.select("table tbody tr, .factory-row, .factory-card")
                for row in rows:
                    cells = row.select("td")
                    if len(cells) >= 5:
                        factories.append({
                            "rsc_factory_name":    cells[0].get_text(strip=True),
                            "rsc_id":             cells[1].get_text(strip=True),
                            "rsc_location":       cells[2].get_text(strip=True),
                            "rsc_fire_pct":       parse_pct(cells[3].get_text()),
                            "rsc_structural_pct": parse_pct(cells[4].get_text()),
                        })

            # Check for next page
            next_btn = page.query_selector("button[aria-label='next'], .next-page, [data-page='next']")
            if not next_btn or not next_btn.is_enabled():
                break

            next_btn.click()
            page.wait_for_load_state("networkidle")
            current_page += 1
            print(f"RSC page {current_page}, collected {len(factories)} so far")

        browser.close()

    print(f"Total RSC factories collected: {len(factories)}")
    return factories


def parse_pct(text: str) -> float | None:
    """Extract percentage from text like '87.5%' or '87.5 / 100'."""
    import re
    match = re.search(r'(\d+(?:\.\d+)?)', text)
    return float(match.group(1)) if match else None


def rsc_to_sbi_score(rsc_record: dict) -> dict:
    """
    Convert RSC data to SBI Pillar 2 (Safety & Remediation) scores.
    Max 30 points available in Pillar 2.
    """
    fire_pct       = rsc_record.get("rsc_fire_pct") or 0
    structural_pct = rsc_record.get("rsc_structural_pct") or 0
    electrical_pct = rsc_record.get("rsc_electrical_pct") or 0

    # Fire safety (max 15 pts): 100% = 15, 80-99% = 12, 60-79% = 8, <60% = 3, not started = 0
    if fire_pct >= 100: fire_score = 15
    elif fire_pct >= 80: fire_score = 12
    elif fire_pct >= 60: fire_score = 8
    elif fire_pct > 0:   fire_score = 3
    else:                fire_score = 0

    # Structural safety (max 10 pts)
    if structural_pct >= 100: structural_score = 10
    elif structural_pct >= 80: structural_score = 8
    elif structural_pct >= 60: structural_score = 5
    elif structural_pct > 0:   structural_score = 2
    else:                       structural_score = 0

    # DIFE clean record (max 5 pts) — checked separately
    dife_score = 5  # Default to 5, reduce if violation found

    return {
        "rsc_fire_score":        fire_score,
        "rsc_structural_score":  structural_score,
        "pillar2_total":         fire_score + structural_score + dife_score,
        "rsc_complete":          fire_pct >= 100 and structural_pct >= 100,
    }
```

### 6.3 RSC → SourceBD matching

RSC factory names often differ slightly from BGMEA/BKMEA names (e.g., "ABC Garments Ltd" vs "ABC Garment Limited"). Use fuzzy matching with location as a secondary signal:

```python
def match_rsc_to_supplier(
    rsc_factory: dict,
    suppliers_db: list[dict],
    threshold: float = 0.88
) -> dict | None:
    """
    RSC match uses lower threshold (0.88 not 0.92) because RSC has abbreviations.
    Location as tiebreaker when multiple matches.
    """
    candidates = process.extract(
        normalize_company_name(rsc_factory["rsc_factory_name"]),
        {s["slug"]: normalize_company_name(s["company_name"]) for s in suppliers_db},
        scorer=fuzz.token_sort_ratio,
        limit=5,
        score_cutoff=threshold * 100,
    )

    if not candidates:
        return None

    if len(candidates) == 1:
        slug = candidates[0][2]
        return next(s for s in suppliers_db if s["slug"] == slug)

    # Multiple candidates — use location as tiebreaker
    rsc_loc = rsc_factory.get("rsc_location", "").lower()
    for name, score, slug in candidates:
        supplier = next((s for s in suppliers_db if s["slug"] == slug), None)
        if supplier and rsc_loc in supplier.get("city", "").lower():
            return supplier

    # Return highest scorer if no location match
    slug = candidates[0][2]
    return next(s for s in suppliers_db if s["slug"] == slug)
```

---

## 7. ADVANCED ENRICHMENT — US, UK, EU AUTHORITIES

### 7.1 UK Sources

#### UK Modern Slavery Registry
**URL**: https://modern-slavery.homeoffice.gov.uk/
**What it gives you**: Every UK company with £36M+ turnover must publish an annual MSA statement. These statements name their Bangladesh suppliers.

```python
# Mine MSA statements to find which UK brands source from BD
# Each statement PDF is publicly downloadable
# Extract: company_name → named Bangladesh suppliers

import requests
MSA_REGISTRY_API = "https://modern-slavery.homeoffice.gov.uk/api/statements"

def fetch_msa_bangladesh_suppliers():
    """
    Search MSA statements that mention Bangladesh/Dhaka.
    Returns: {uk_brand: [bangladesh_supplier_names]}
    """
    params = {
        "search": "Bangladesh",
        "year": "2024",
        "format": "json",
    }
    resp = requests.get(MSA_REGISTRY_API, params=params)
    statements = resp.json().get("results", [])

    for statement in statements:
        pdf_url = statement.get("pdf_url")
        if pdf_url:
            # Download and extract text — then NER for company names
            pdf_text = extract_pdf_text(pdf_url)
            bd_suppliers = extract_bangladesh_mentions(pdf_text)
            # bd_suppliers now enriches the Tier 4 (brand supplier lists) data
```

#### UK Companies House
**URL**: https://api.company-information.service.gov.uk/
**API Key**: Free registration required
**What it gives you**: UK-registered entities with Bangladesh addresses / directors

```python
COMPANIES_HOUSE_API = "https://api.company-information.service.gov.uk"
API_KEY = os.environ["COMPANIES_HOUSE_KEY"]

def search_bangladesh_companies():
    """Find UK-registered entities with Bangladesh operations."""
    resp = requests.get(
        f"{COMPANIES_HOUSE_API}/search/companies",
        params={"q": "Bangladesh garment", "items_per_page": 100},
        auth=(API_KEY, ""),
    )
    return resp.json().get("items", [])
```

#### UKFT (UK Fashion & Textile Association) — Partnership
Not scrapable — requires a partnership agreement. Recommended action: contact UKFT and offer to be their "Bangladesh intelligence partner." They will likely share their member supplier lists in exchange for SourceBD access.

### 7.2 US Sources

#### US CBP UFLPA Entity List
**URL**: https://www.cbp.gov/trade/forced-labor/UFLPA
**Format**: PDF published by DHS (updated periodically)
**What it gives you**: Companies BANNED from US imports — CROSS-CHECK EVERY RECORD

```python
UFLPA_ENTITY_LIST_URL = "https://www.dhs.gov/sites/default/files/2022-10/UFLPA_Entity_List.pdf"

def fetch_uflpa_banned_list() -> list[str]:
    """
    Download and parse the UFLPA Entity List PDF.
    Flag any SourceBD supplier that matches.
    """
    resp = requests.get(UFLPA_ENTITY_LIST_URL)
    text = extract_pdf_text_from_bytes(resp.content)
    # Extract company names from structured list
    # Add to suppliers.uflpa_banned = TRUE for any match
    # This immediately drops SBI score to ZERO and shows red banner
```

#### US CBP Withhold Release Orders (WRO)
**URL**: https://www.cbp.gov/trade/forced-labor/withhold-release-orders-and-findings
**Format**: Web page with downloadable lists

#### US Dept of Labor — ILAB TVPRA List
**URL**: https://www.dol.gov/agencies/ilab/reports/child-labor/list-of-goods
**What it gives you**: Goods produced with child or forced labor — by country
**Bangladesh-specific**: Identifies garment sector risks by region

```python
ILAB_API = "https://www.dol.gov/sites/dolgov/files/ILAB/ListofGoods.pdf"
# Parse and extract Bangladesh-specific sectors
# Use this to add risk flags to Bangladesh factory SBI scores
```

#### US SEC EDGAR — Supply Chain Disclosures
Large US public companies (Gap, PVH, VF Corp, Hanesbrands, Ralph Lauren) must disclose supplier factories in SEC filings when material.

```python
SEC_EDGAR_API = "https://efts.sec.gov/LATEST/search-index?q=%22Bangladesh%22+%22supplier%22&dateRange=custom&startdt=2023-01-01"

def search_sec_bangladesh_suppliers():
    resp = requests.get(SEC_EDGAR_API)
    filings = resp.json().get("hits", {}).get("hits", [])
    for filing in filings:
        # Download filing, extract supplier names, cross-reference with SourceBD
        pass
```

### 7.3 EU Sources

#### EU CSRD (Corporate Sustainability Reporting Directive)
From 2024, EU companies >500 employees must disclose supply chain due diligence. Mining these for Bangladesh supplier names.

**Key targets for scraping:**
- H&M Group Annual Report (hm.com/en_gb/sustainability/transparency/supplier-list.html) — already public
- Inditex (Zara, Pull&Bear) supplier list
- C&A transparency report
- Primark ethical trade reports (UK + EU markets)

#### German LkSG (Supply Chain Due Diligence Act)
German companies must publish supply chain risk reports. The German Federal Office for Economics (BAFA) publishes enforcement data.

**URL**: https://www.bafa.de/DE/Lieferketten/lieferketten_node.html

#### Dutch IMVO (Responsible Business Conduct)
#### French Duty of Vigilance (Loi de Vigilance)
French CAC 40 companies must publish annual vigilance plans naming high-risk supplier countries and mitigations.

### 7.4 Brand Supplier Lists — Scraping Guide

These are the highest-value Tier 4 sources. Each brand publishes annually due to MSA/EU obligations:

```python
BRAND_SUPPLIER_LISTS = {
    "HM_Group": {
        "url": "https://hmgroup.com/sustainability/leading-the-change/transparency/supplier-list/",
        "format": "excel",  # H&M publishes as Excel
        "update_frequency": "quarterly",
        "columns": ["supplier_name", "factory_name", "country", "product_type", "workers"],
    },
    "Marks_Spencer": {
        "url": "https://corporate.marksandspencer.com/sites/marksandspencer/files/2024-05/MS_Factory_List_2024.xlsx",
        "format": "excel",
        "update_frequency": "annual",
    },
    "Next": {
        "url": "https://www.nextplc.co.uk/corporate-responsibility/sustainability/supply-chain",
        "format": "pdf",
    },
    "Primark": {
        "url": "https://www.primarkfashion.com/us/en/corporate/ethics/factory-list",
        "format": "web",
    },
    "PVH_Corp": {  # Calvin Klein, Tommy Hilfiger
        "url": "https://www.pvhcsr.com/supply-chain",
        "format": "excel",
    },
    "Patagonia": {
        "url": "https://www.patagonia.com/on/demandware.static/-/Library-Sites-PatagoniaShared/default/factorylist.pdf",
        "format": "pdf",
    },
    "Nike": {
        "url": "https://manufacturingmap.nikeinc.com/",
        "format": "api",  # Nike has a manufacturing map API
    },
    "Gap_Inc": {  # Gap, Old Navy, Banana Republic, Athleta
        "url": "https://www.gapinc.com/content/dam/gap-inc-sharing/approved-factory-list.xlsx",
        "format": "excel",
    },
    "Adidas": {
        "url": "https://www.adidas-group.com/en/sustainability/social/supply-chain-transparency/",
        "format": "excel",
    },
}

async def fetch_brand_supplier_list(brand: str, config: dict) -> list[dict]:
    """
    Fetch and parse a brand's Bangladesh factory list.
    Filter to Bangladesh entries only.
    """
    if config["format"] == "excel":
        df = pd.read_excel(config["url"])
        bd_factories = df[df["country"].str.contains("Bangladesh", case=False, na=False)]
        return bd_factories.to_dict("records")

    elif config["format"] == "pdf":
        text = extract_pdf_text(requests.get(config["url"]).content)
        # Extract Bangladesh section
        bd_section = extract_country_section(text, "Bangladesh")
        return parse_factory_names(bd_section)

    elif config["format"] == "api":
        resp = requests.get(config["url"] + "?country=BGD")
        return resp.json().get("factories", [])
```

### 7.5 Certification Portal Scraping

```python
CERT_SOURCES = {
    "WRAP": {
        "search_url": "https://wrapcompliance.org/certified-facilities/?country=BD",
        "data_fields": ["facility_name", "country", "cert_number", "cert_date", "expiry_date", "products"],
        "note": "WRAP publishes full searchable database — can filter by country=Bangladesh",
    },
    "BSCI_amfori": {
        "search_url": "https://www.amfori.org/members",
        "note": "Requires amfori member login for full data. Negotiate data partnership.",
        "alternative": "BSCI audit summaries are in brand CSR reports — mine those instead",
    },
    "OEKO_TEX": {
        "search_url": "https://www.oeko-tex.com/en/our-standards/certification-and-labelling/certified-production-facilities",
        "filter": "country=bangladesh",
        "note": "Fully public — certifcate lookup available",
    },
    "GOTS": {
        "search_url": "https://www.global-standard.org/public-database/current-valid-certificates.html",
        "filter": "country=BD",
    },
    "GRS_Textile_Exchange": {
        "search_url": "https://textileexchange.org/integrity/",
        "note": "Recycled content certification — growing importance for EU market",
    },
    "Fair_Trade_FLOCERT": {
        "search_url": "https://www.flocert.net/solutions/fairtrade/",
        "filter": "country=Bangladesh",
    },
}
```

---

## 8. AUTOMATED ENRICHMENT PIPELINE (Inngest Jobs)

Combine all sources into a scheduled enrichment pipeline:

```typescript
// src/inngest/enrichmentPipeline.ts
import { inngest } from './client'
import { createClient } from '@supabase/supabase-js'

// Daily: Check RSC for any remediation updates
export const syncRscData = inngest.createFunction(
  { id: 'sync-rsc-daily' },
  { cron: '0 2 * * *' },  // 2AM UTC daily
  async ({ step }) => {
    const factories = await step.run('fetch-rsc', async () => {
      return fetchRscFactories()  // scraper from Section 6
    })

    const updates = await step.run('match-and-update', async () => {
      return matchRscToSuppliers(factories)
    })

    await step.run('recalculate-scores', async () => {
      for (const supplierId of updates.affectedIds) {
        await triggerScoreRecalculation(supplierId)
      }
    })

    return { updated: updates.count }
  }
)

// Weekly: Sync brand supplier lists
export const syncBrandLists = inngest.createFunction(
  { id: 'sync-brand-lists-weekly' },
  { cron: '0 3 * * 1' },  // Monday 3AM UTC
  async ({ step }) => {
    const brands = Object.entries(BRAND_SUPPLIER_LISTS)

    for (const [brand, config] of brands) {
      await step.run(`fetch-${brand}`, async () => {
        const factories = await fetchBrandSupplierList(brand, config)
        const bdFactories = factories.filter(f =>
          (f.country || '').toLowerCase().includes('bangladesh')
        )
        for (const factory of bdFactories) {
          const match = await matchToSupplier(factory)
          if (match) {
            await addBrandReference(match.id, brand, factory)
            await step.run(`score-${match.id}`, async () => {
              await recalculateScore(match.id)
            })
          }
        }
      })
    }
  }
)

// Monthly: Re-check UFLPA Entity List
export const checkUflpaList = inngest.createFunction(
  { id: 'check-uflpa-monthly' },
  { cron: '0 4 1 * *' },  // 1st of each month
  async ({ step }) => {
    const banned = await step.run('fetch-uflpa-list', fetchUflpaEntityList)

    await step.run('flag-matches', async () => {
      for (const bannedEntity of banned) {
        const match = await matchToSupplier(bannedEntity)
        if (match) {
          await supabase.from('suppliers').update({
            uflpa_banned: true,
            sanctions_status: 'flagged',
            sbi_score: 0,  // Immediate score drop to zero
          }).eq('id', match.id)

          await sendAlertToSavedBuyers(match.id, 'uflpa_ban')
        }
      }
    })
  }
)

// Quarterly: Scrape WRAP certification database
export const syncWrapCerts = inngest.createFunction(
  { id: 'sync-wrap-quarterly' },
  { cron: '0 5 1 1,4,7,10 *' },  // Quarterly
  async ({ step }) => {
    const wrapFacilities = await step.run('fetch-wrap', fetchWrapBangladesh)

    for (const facility of wrapFacilities) {
      await step.run(`process-${facility.cert_number}`, async () => {
        const match = await matchToSupplier(facility)
        if (match) {
          await upsertCertification(match.id, {
            cert_type: 'WRAP',
            cert_number: facility.cert_number,
            issued_date: facility.cert_date,
            expiry_date: facility.expiry_date,
            source: 'WRAP_PORTAL',
          })
          await recalculateScore(match.id)
        }
      })
    }
  }
)
```

---

## 9. MANUAL VERIFICATION WORKFLOW

Not everything can be automated. Establish a human-in-the-loop queue for:

1. **Fuzzy matches below 90% confidence** — show admin side-by-side for yes/no decision
2. **Companies in exporter PDF with no corroboration** — email the company to verify
3. **RSC factories with zero BGMEA/BKMEA match** — may be unlisted factories; valuable but needs care
4. **Companies flagged by UFLPA/sanctions** — human must review before public flag
5. **New certification documents submitted by suppliers** — review against certification portal

### Admin queue database table

```sql
CREATE TABLE public.verification_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_type      TEXT NOT NULL CHECK (queue_type IN (
                    'fuzzy_match_review',
                    'exporter_pdf_unverified',
                    'rsc_unmatched',
                    'sanctions_flag',
                    'cert_document_review'
                  )),
  supplier_a_id   UUID REFERENCES suppliers(id),
  supplier_b_name TEXT,            -- unmatched name candidate
  confidence      DECIMAL(4,3),    -- 0.000-1.000
  source_data     JSONB,
  admin_action    TEXT,            -- 'merge' | 'new_record' | 'reject' | 'escalate'
  reviewed_by     UUID REFERENCES profiles(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 10. DATABASE COMPLETENESS TRACKER

Track how complete each record is — drives the admin dashboard and supplier portal completion % prompts:

```sql
CREATE OR REPLACE FUNCTION compute_completeness(supplier_id UUID)
RETURNS INTEGER AS $$
DECLARE
  s suppliers%ROWTYPE;
  score INTEGER := 0;
BEGIN
  SELECT * INTO s FROM suppliers WHERE id = supplier_id;

  -- Identity (30 pts)
  IF s.company_name IS NOT NULL   THEN score := score + 5; END IF;
  IF s.bgmea_verified             THEN score := score + 10; END IF;
  IF s.bkmea_verified             THEN score := score + 8; END IF;
  IF s.rjsc_reg_number IS NOT NULL THEN score := score + 7; END IF;

  -- Contact (20 pts)
  IF s.email_primary IS NOT NULL  THEN score := score + 8; END IF;
  IF s.phone_primary IS NOT NULL  THEN score := score + 5; END IF;
  IF s.address_raw IS NOT NULL    THEN score := score + 4; END IF;
  IF s.contact_name IS NOT NULL   THEN score := score + 3; END IF;

  -- Compliance (30 pts)
  IF s.rsc_fire_pct = 100        THEN score := score + 10; END IF;
  IF s.rsc_structural_pct = 100  THEN score := score + 8; END IF;
  IF (SELECT COUNT(*) FROM certifications WHERE supplier_id = s.id) > 0
                                  THEN score := score + 12; END IF;

  -- Market (20 pts)
  IF (SELECT COUNT(*) FROM brand_references WHERE supplier_id = s.id) > 0
                                  THEN score := score + 10; END IF;
  IF s.claimed_by IS NOT NULL     THEN score := score + 10; END IF;

  RETURN score;
END;
$$ LANGUAGE plpgsql;
```

---

## 11. LAUNCH DATA TARGETS

### Phase 0 (Pre-launch — build in private):
| Source | Target records | Notes |
|---|---|---|
| BGMEA Buying House PDF | 1,759 buying houses | Import now — data in hand |
| BKMEA website | ~1,500+ factories | Scrape this week |
| RSC database | 1,928 factories | Highest priority compliance data |
| WRAP Bangladesh | ~500 certified factories | Public portal |
| OEKO-TEX Bangladesh | ~300 facilities | Public search |

### Phase 1 (Launch):
| Source | Target records | Notes |
|---|---|---|
| Brand supplier lists (H&M, M&S, Patagonia, PVH, Gap, Nike) | Enriches ~400–600 existing records | Cross-reference only |
| UFLPA Entity List cross-check | 0 records imported, all existing checked | Safety gate |
| BSCI amfori (via brand CSR reports) | Enriches ~200–300 records | |

### Phase 2 (Post-launch, data network effects):
| Source | Target | Notes |
|---|---|---|
| UK MSA Registry mining | 200+ BD supplier name extractions | NLP on PDFs |
| US SEC EDGAR supply chain | 150+ BD mentions from public filings | |
| EU CSRD reports | Growing in 2025 onwards | |
| Supplier self-submitted data | Goal: 10% of records claimed | Drives completeness |

---

## 12. DATA FRESHNESS POLICY

| Data type | Staleness tolerance | Re-fetch frequency |
|---|---|---|
| RSC remediation % | 7 days | Weekly sync |
| WRAP certification expiry | 30 days | Monthly |
| Brand supplier lists | 90 days | Quarterly |
| BGMEA register | 6 months | Semi-annual |
| BKMEA register | 6 months | Semi-annual |
| UFLPA Entity List | 7 days | Weekly |
| UK sanctions (OFSI) | 24 hours | Daily |
| US sanctions (OFAC SDN) | 24 hours | Daily |
| Company contact details | 12 months | Annual + supplier-triggered |

---

*Data Pipeline Spec v1.0 — supplement to SourceBD Master Spec*
*This document governs all database import, enrichment, and freshness decisions*
