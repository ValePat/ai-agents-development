"""
Centralized configuration for show macro parameters.
Loads from variables.json.
"""

import json
import os
from typing import Dict, List, Any

SHOWS_FILE = os.path.join(os.path.dirname(__file__), "..", "shows.json")

def load_variables() -> List[Dict[str, Any]]:
    """Load variable definitions from the active show in shows.json."""
    if not os.path.exists(SHOWS_FILE):
        return []
    try:
        with open(SHOWS_FILE, "r") as f:
            data = json.load(f)
            active_id = data.get("active_show_id", "default_show")
            
            # Try to find the active show
            for show in data.get("shows", []):
                if show["id"] == active_id:
                    return show.get("variables", [])
            
            # Fallback to default_show if active_id not found
            if active_id != "default_show":
                for show in data.get("shows", []):
                    if show["id"] == "default_show":
                        return show.get("variables", [])
    except Exception as e:
        print(f"Error loading variables: {e}")
    return []

def save_variables(variables: List[Dict[str, Any]]) -> None:
    """Save variable definitions to the active show in shows.json."""
    if not os.path.exists(SHOWS_FILE):
        return
    try:
        with open(SHOWS_FILE, "r") as f:
            data = json.load(f)
        
        active_id = data.get("active_show_id", "default_show")
        target_id = active_id
        
        # Check if active show exists
        show_exists = any(s["id"] == active_id for s in data.get("shows", []))
        if not show_exists:
            target_id = "default_show"
            
        found = False
        for show in data.get("shows", []):
            if show["id"] == target_id:
                show["variables"] = variables
                found = True
                break
        
        if found:
            with open(SHOWS_FILE, "w") as f:
                json.dump(data, f, indent=2)
        else:
            print(f"Failed to save variables: Show '{target_id}' not found.")
    except Exception as e:
        print(f"Failed to save variables: {e}")

def get_macro_config():
    """
    Returns dictionaries of numeric and string macro fields,
    and a mapping for custom OSC paths and categories.
    """
    vars_list = load_variables()
    numeric = {}
    string = {}
    osc_paths = {}
    categories = {}
    
    for v in vars_list:
        if v["type"] == "numeric":
            numeric[v["name"]] = v["description"]
        else:
            string[v["name"]] = v["description"]
        
        if v.get("osc_path"):
            osc_paths[v["name"]] = v["osc_path"]
            
        categories[v["name"]] = v.get("category", "Music")
            
    return numeric, string, osc_paths, categories

# For backward compatibility and initial load
MACRO_NUMERIC_FIELDS, MACRO_STRING_FIELDS, OSC_PATHS, VARIABLE_CATEGORIES = get_macro_config()
ALL_FIELDS = list(MACRO_NUMERIC_FIELDS.keys()) + list(MACRO_STRING_FIELDS.keys())

def refresh_config():
    """Update the global field lists (useful if variables change at runtime)."""
    global MACRO_NUMERIC_FIELDS, MACRO_STRING_FIELDS, ALL_FIELDS, OSC_PATHS, VARIABLE_CATEGORIES
    MACRO_NUMERIC_FIELDS, MACRO_STRING_FIELDS, OSC_PATHS, VARIABLE_CATEGORIES = get_macro_config()
    ALL_FIELDS = list(MACRO_NUMERIC_FIELDS.keys()) + list(MACRO_STRING_FIELDS.keys())
