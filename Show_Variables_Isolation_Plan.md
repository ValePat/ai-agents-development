# Show-Specific Variables Implementation Plan

## Objective
Migrate macro variables from a global configuration (`variables.json`) to be show-specific by embedding them within the `ShowProfile` in `shows.json`. This ensures that when a user switches shows, the available sliders, LLM context, and OSC targets update dynamically to match the selected show.

## Key Files & Context
- **`backend/orchestrator/models.py`**: Add `variables` array to `ShowProfile`.
- **`backend/orchestrator/config.py`**: Rewrite load/save to target the active show inside `shows.json` rather than a separate file.
- **`backend/orchestrator/router.py`**: Trigger global engine reinitialization when the active show is switched.
- **`frontend/app/page.tsx`**: Re-fetch variables when the active show changes.
- **`frontend/app/config/page.tsx`**: Display the active show name so the user knows which show's variables they are editing.

## Implementation Steps

### Phase 1: Data Model and Storage Migration
1.  **Update `ShowProfile` Model**:
    - In `backend/orchestrator/models.py`, add `variables: List[VariableDefinition] = Field(default_factory=list)` to the `ShowProfile` class.
2.  **Migrate Existing Data**:
    - Manually copy the contents of `backend/orchestrator/variables.json` into the `variables` array of the `default_show` profile in `backend/shows.json`.
    - Delete `backend/orchestrator/variables.json`.
3.  **Rewrite `config.py`**:
    - Update `load_variables()` to read `backend/shows.json`, find the `active_show_id`, and return that show's `variables` array.
    - Update `save_variables()` to write the modified array back to the active show in `backend/shows.json`.

### Phase 2: Backend Switch Handlers
1.  **Update `set_active_show` API**:
    - In `backend/orchestrator/router.py`, modify the `POST /shows/active` endpoint. After saving the new active show ID, add:
      ```python
      refresh_config()
      refresh_models()
      if engine:
          engine.reinitialize()
      ```
    - This ensures the Interpolation Engine instantly drops old macro fields and tracks the new show's macros.

### Phase 3: Frontend Reactivity
1.  **Main Dashboard (`page.tsx`)**:
    - Extract the variable fetching logic (`fetchVars`) into a `useCallback`.
    - Call `fetchVars()` whenever `activeShow?.id` changes via a `useEffect`.
2.  **Config Page Context**:
    - Fetch the active show profile in `/config/page.tsx` or `ConfigurationDashboard.tsx`.
    - Display a clear banner: "Editing variables for Show: [Show Name]".

## Legacy Preset Handling
As requested, the `PresetBank` already handles legacy variables correctly. If a variable is deleted, the backend `MacroTarget` validation (which uses `extra="allow"`) ignores the legacy variable, and the Interpolation Engine only processes fields that exist in the active `ALL_FIELDS`. No backend or frontend data migration is needed for presets.

## Verification & Testing
1. Verify the `shows.json` file now contains the variables.
2. Verify switching to a new show with no variables results in an empty dashboard.
3. Verify adding a variable in `/config` only adds it to the active show.
4. Verify the WebSocket correctly broadcasts the new variables after a show switch.
