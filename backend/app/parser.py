import re
from typing import Optional, Dict, Any

def clean_numeric_value(val_str: str) -> Optional[float]:
    """
    Helper to extract a float number from a string, removing currency symbols,
    commas, spaces, and other non-numeric text.
    """
    if not val_str:
        return None
    # Remove everything except digits, dots, and minus signs
    cleaned = re.sub(r'[^\d\.\-]', '', val_str)
    try:
        if not cleaned:
            return None
        return float(cleaned) if '.' in cleaned else float(int(cleaned))
    except ValueError:
        # Fallback: search for the first valid decimal/integer sequence
        match = re.search(r'-?\d+(?:\.\d+)?', val_str)
        if match:
            try:
                val = match.group(0)
                return float(val) if '.' in val else float(int(val))
            except ValueError:
                return None
        return None

def extract_challan_data(text: str) -> Dict[str, Any]:
    """
    Parses raw OCR text to extract structured challan fields:
    - challan_date: str or None
    - source_address: str or None
    - destination_address: str or None
    - total_kg: float or None
    - total_cost: float or None
    """
    if not text:
        return {
            "challan_date": None,
            "source_address": None,
            "destination_address": None,
            "total_kg": None,
            "total_cost": None
        }

    # Split text into lines, strip them, and filter out empty lines
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    text_lower = text.lower()

    # --- 1. EXTRACT CHALLAN DATE ---
    challan_date = None
    date_patterns = [
        r'\b\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}\b',
        r'\b\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}\b',
        r'\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}\b'
    ]

    # Search for a date on the same line as a "date" or "dt" or "challan" keyword first
    date_keyword_match = None
    for line in lines:
        line_lower = line.lower()
        if any(kw in line_lower for kw in ["date", "dt:", "dt.", "challan"]):
            for pattern in date_patterns:
                # Search case-insensitively using re.IGNORECASE
                match = re.search(pattern, line_lower, re.IGNORECASE)
                if match:
                    # Match from original line to preserve casing/formatting
                    orig_match = re.search(pattern, line, re.IGNORECASE)
                    if orig_match:
                        date_keyword_match = orig_match.group(0)
                        break
            if date_keyword_match:
                break

    if date_keyword_match:
        challan_date = date_keyword_match
    else:
        # Fallback: search the entire text for the first date-like pattern
        for pattern in date_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                challan_date = match.group(0)
                break

    # --- 2. EXTRACT SOURCE ADDRESS ---
    source_address = None
    source_keywords = ["from:", "consignor:", "shipper:", "source:", "loading point:", "dispatched from:", "sender:"]
    
    for i, line in enumerate(lines):
        line_lower = line.lower()
        if any(keyword in line_lower for keyword in source_keywords):
            # Split by colon to capture same-line content
            colon_split = re.split(r':', line, maxsplit=1)
            same_line_content = colon_split[1].strip() if len(colon_split) > 1 else ""
            
            address_lines = []
            if same_line_content and not any(kw in same_line_content.lower() for kw in ["to:", "consignee:", "destination:"]):
                address_lines.append(same_line_content)
            
            # Gather up to 3 subsequent lines
            stop_keywords = ["to:", "consignee:", "destination:", "ship to:", "delivery:", "date:", "invoice:", "challan:"]
            for j in range(i + 1, min(i + 4, len(lines))):
                next_line = lines[j]
                if any(sk in next_line.lower() for sk in stop_keywords):
                    break
                # Skip lines containing numbers and identifiers like GSTIN, PAN, Phone numbers
                if re.search(r'\b(?:gstin|gst|pan|phone|tel|mob|mobile|email|emailid)\b', next_line.lower()):
                    continue
                address_lines.append(next_line)
            
            if address_lines:
                source_address = ", ".join(address_lines)
                break

    # --- 3. EXTRACT DESTINATION ADDRESS ---
    destination_address = None
    dest_keywords = ["to:", "consignee:", "destination:", "delivery point:", "ship to:", "unloading point:", "receiver:", "consign to:"]
    
    for i, line in enumerate(lines):
        line_lower = line.lower()
        if any(keyword in line_lower for keyword in dest_keywords):
            # Split by colon
            colon_split = re.split(r':', line, maxsplit=1)
            same_line_content = colon_split[1].strip() if len(colon_split) > 1 else ""
            
            address_lines = []
            if same_line_content and not any(kw in same_line_content.lower() for kw in ["from:", "consignor:", "shipper:", "source:"]):
                address_lines.append(same_line_content)
                
            stop_keywords = ["from:", "consignor:", "shipper:", "source:", "date:", "invoice:", "challan:", "total:"]
            for j in range(i + 1, min(i + 4, len(lines))):
                next_line = lines[j]
                if any(sk in next_line.lower() for sk in stop_keywords):
                    break
                if re.search(r'\b(?:gstin|gst|pan|phone|tel|mob|mobile|email|emailid)\b', next_line.lower()):
                    continue
                address_lines.append(next_line)
            
            if address_lines:
                destination_address = ", ".join(address_lines)
                break

    # --- 4. EXTRACT TOTAL NUMBER OF KG ---
    total_kg = None
    # Look for patterns like "1,200 kg", "500 kgs", "1500 kilograms"
    weight_regex = r'\b(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:kg|kgs|kilogram|kilograms)\b'
    weight_matches = re.findall(weight_regex, text_lower)
    
    # Try to find a line with "total", "net", or "gross" that also matches weight_regex
    total_line_weight = None
    for line in lines:
        line_lower = line.lower()
        if any(kw in line_lower for kw in ["total", "net", "gross", "weight"]):
            m = re.search(weight_regex, line_lower)
            if m:
                total_line_weight = m.group(1)
                break
                
    if total_line_weight:
        total_kg = clean_numeric_value(total_line_weight)
    elif weight_matches:
        # Fallback to the last weight match (totals are usually at the bottom of the document)
        total_kg = clean_numeric_value(weight_matches[-1])
        
    # Second fallback: Search for lines with "weight" or "qty" followed by a number
    if total_kg is None:
        for line in lines:
            line_lower = line.lower()
            if any(kw in line_lower for kw in ["total weight", "net weight", "gross weight", "qty", "quantity", "charged wt"]):
                num_match = re.search(r'\b\d+(?:,\d+)*(?:\.\d+)?\b', line_lower)
                if num_match:
                    total_kg = clean_numeric_value(num_match.group(0))
                    break

    # --- 5. EXTRACT TOTAL COST ---
    total_cost = None
    cost_keywords = ["total", "grand total", "total amount", "net amount", "total freight", "charges", "freight", "net value"]
    
    for line in lines:
        line_lower = line.lower()
        if any(ck in line_lower for ck in cost_keywords):
            # Look for number possibly preceded by currency indicators
            num_match = re.search(r'(?:rs\.?|inr|₹|\$|usd)?\s*[:\.-]?\s*(\d+(?:,\d+)*(?:\.\d+)?)\b', line_lower)
            if num_match:
                val = clean_numeric_value(num_match.group(1))
                # Validate it's a realistic non-zero cost (exclude dates or small numbers/ID keys like years)
                # But keep it if it is the best we have.
                if val and val > 100:
                    total_cost = val
                    break
                    
    if total_cost is None:
        # Fallback: search for numbers preceded directly by currency symbols
        currency_regex = r'(?:rs\.?|inr|₹|\$)\s*(\d+(?:,\d+)*(?:\.\d+)?)\b'
        currency_matches = re.findall(currency_regex, text_lower)
        if currency_matches:
            total_cost = clean_numeric_value(currency_matches[-1])

    return {
        "challan_date": challan_date,
        "source_address": source_address,
        "destination_address": destination_address,
        "total_kg": total_kg,
        "total_cost": total_cost
    }
