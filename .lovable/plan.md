Move the Net Gain scoreboard above the shift action section on the My Day page.

Current layout in `src/features/myDay/MyDayPage.tsx`:
1. Floating header
2. Persistent reminder banner
3. **Shift Task Checklist (ShiftChecklist)**
4. OfflineBanner
5. **NetGainScoreboard**

Change:
- Move the `<NetGainScoreboard />` block up so it sits immediately below the persistent reminder banner and above the `<ShiftChecklist />` block.
- Adjust top/bottom spacing (`mt-3` / `pt-3`) as needed so the new order still reads as a single intentional stack without double gaps.

No other components, data, or behavior changes.