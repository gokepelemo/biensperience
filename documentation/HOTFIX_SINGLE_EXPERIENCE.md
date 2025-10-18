# Hotfix: Single Experience Loading Error

**Date**: October 13, 2025  
**Issue**: HTTP 400 error when loading single experience view  
**Status**: ✅ FIXED

---

## Problem

After refactoring to remove `experience.users` array, the single experience endpoint was failing with:

```
Error: Failed to load resource: the server responded with a status of 400 (Bad Request)
HTTP 400 Bad Request: {"error":"Failed to fetch experience"}
```

**Root Cause**: The `showExperience` function in `controllers/api/experiences.js` was still trying to populate `users.user` path which no longer exists in the Experience model.

```javascript
// BEFORE (causing error)
let experience = await Experience.findById(req.params.id)
  .populate("destination")
  .populate("users.user")  // ❌ This field doesn't exist anymore
  .populate("user");
```

---

## Solution

Removed the obsolete `.populate("users.user")` call from the `showExperience` function.

```javascript
// AFTER (fixed)
let experience = await Experience.findById(req.params.id)
  .populate("destination")
  .populate("user");  // ✅ Only populate what exists
```

---

## Files Modified

- `controllers/api/experiences.js` (line 84) - Removed `.populate("users.user")`
- `regression-tests.sh` - Added test for single experience loading (Test 5.5)

---

## Testing

### Manual Test
```bash
curl -X GET "http://localhost:3001/api/experiences/653d3977b928f67f6b98bac7" \
  -H "Authorization: Bearer $TOKEN"

# Response: ✅ 200 OK
{
  "_id": "653d3977b928f67f6b98bac7",
  "name": "Winery Tour at Chateau Amsterdam",
  "destination": "Amsterdam",
  "user": "Goke Pelemo"
}
```

### Regression Tests
**All 10 tests passing** ✅

New test added:
```
✓ PASS: Get single experience (no users.user populate error)
```

---

## Impact

- **Fixed**: Single experience view now loads correctly
- **Verified**: All other endpoints still functioning
- **Added**: Regression test to prevent future occurrences

---

## Prevention

This issue occurred because one populate call was missed during the refactoring. To prevent similar issues:

1. ✅ Added regression test for single experience endpoint
2. ✅ Verified no other `users.user` populate calls exist
3. 📝 Recommendation: Run full regression suite after major refactors

---

**Status**: ✅ Resolved and Tested  
**Server**: Online (PM2 restart #163)  
**All Tests**: 10/10 Passing
