"""
Centralized configuration for show macro parameters.
Loads from variables.json.
"""

import json
import os
from typing import Dict, List, Any

VARIABLES_FILE = os.path.join(os.path.dirname(__file__), "variables.json")

def load_variables() -> List[Dict[str, Any]]:
    """Load variable definitions from the JSON file."""
    if not os.path.exists(VARIABLES_FILE):
        return []
    with open(VARIABLES_FILE, "r") as f:
        return json.load(f)

def save_variables(variables: List[Dict[str, Any]]) -> None:
    """Save variable definitions to the JSON file."""
    with open(VARIABLES_FILE, "w") as f:
        json.dump(variables, f, indent=2)

def get_macro_config():
    """
    Returns dictionaries of numeric and string macro fields.
    Re-evaluates the JSON file on each call (or we can cache it).
    """
    vars_list = load_variables()
    numeric = {}
    string = {}
    
    for v in vars_list:
        if v["type"] == "numeric":
            numeric[v["name"]] = v["description"]
        else:
            string[v["name"]] = v["description"]
            
    return numeric, string

# For backward compatibility and initial load
MACRO_NUMERIC_FIELDS, MACRO_STRING_FIELDS = get_macro_config()
ALL_FIELDS = list(MACRO_NUMERIC_FIELDS.keys()) + list(MACRO_STRING_FIELDS.keys())

def refresh_config():
    """Update the global field lists (useful if variables change at runtime)."""
    global MACRO_NUMERIC_FIELDS, MACRO_STRING_FIELDS, ALL_FIELDS
    MACRO_NUMERIC_FIELDS, MACRO_STRING_FIELDS = get_macro_config()
    ALL_FIELDS = list(MACRO_NUMERIC_FIELDS.keys()) + list(MACRO_STRING_FIELDS.keys())
