

## Plan: Admin Sales Editing in Membership Purchases Panel

### Current State
- **Members Who Bought** (`MembershipPurchasesPanel`): Read-only table showing all sales with no edit/delete actions.
- **Pay Period Commission**: Already has a "zero-out commission" trash icon for admins, but no full editing.
- Admin is determined by `user?.role === 'Admin'` from AuthContext.

### Changes

**1. Add Edit/Delete Actions to MembershipPurchasesPanel (primary change)**

Add an actions column (visible to Admins only) to each row in the Members Who Bought table with:
- **Edit button** — opens a dialog allowing the admin to edit: member name, membership type, commission amount, lead source, intro owner, and buy date.
- **Delete button** — opens a confirmation dialog, then hard-deletes the record from `intros_run` or `sales_outside_intro` depending on the `source` field.

The edit dialog will update the correct source table (`intros_run` for intro sales, `sales_outside_intro` for outside sales) and refresh the list.

**2. Files Modified**

- `src/components/admin/MembershipPurchasesPanel.tsx` — Add edit dialog state, delete confirmation dialog, actions column, and the mutation handlers. Pass `useAuth()` to check admin role.

**3. Edit Dialog Fields**
| Field | Source: `intros_run` column | Source: `sales_outside_intro` column |
|---|---|---|
| Member Name | `member_name` | `member_name` |
| Membership Type | `result` | `membership_type` |
| Commission | `commission_amount` | `commission_amount` |
| Lead Source | `lead_source` | `lead_source` |
| Intro Owner | `intro_owner` | `intro_owner` |
| Date | `buy_date` | `date_closed` |

**4. Delete Behavior**
- For `intros_run`: set `commission_amount = 0` and `result = 'Deleted'` (soft-delete approach preserving the run record).
- For `sales_outside_intro`: hard-delete the row since these are manually entered records.
- Confirmation dialog required before either action.

