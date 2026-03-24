

# Remove "All" from VIP Group Dropdown, Default to First Group

## Problem
The VIP dropdown includes an "All" option that isn't needed. Newly created groups should appear, and the dropdown should default to the first available group.

## Changes (`src/features/pipeline/components/VipPipelineTable.tsx`)

1. **Remove "All" option** from the `Select` dropdown (remove the `<SelectItem value="All">` entry)
2. **Change default state** from `'All'` to `''` (empty), then auto-select the first group once data loads
3. **Add a `useEffect`** that sets `selectedGroup` to the first group in the list when groups load (or when the current selection is no longer valid)
4. **Include groups from `vip_sessions`** that have no registrations yet (newly created groups) — merge the session-based group names into the `groups` list during `fetchData`
5. **Update `regLink`** — remove the `selectedGroup !== 'All'` guard since "All" no longer exists
6. **Update `handleAddMember`** — remove the `selectedGroup !== 'All'` check since it's always a real group

| Area | Change |
|------|--------|
| State init | `useState('')` instead of `useState('All')` |
| `fetchData` | Merge group names from `vip_sessions` into `uniqueGroups` so empty new groups appear |
| `useEffect` | Auto-select first group when `groups` changes and current selection is invalid |
| Select dropdown | Remove `<SelectItem value="All">` |
| `regLink` | Simplify — always generate if `selectedGroup` is truthy |
| `handleAddMember` | Remove `'All'` guard |

