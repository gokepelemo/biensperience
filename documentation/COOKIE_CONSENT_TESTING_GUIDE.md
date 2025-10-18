# Cookie Consent - Testing Guide

## Quick Start
```bash
# Start development server
npm start

# Open browser to http://localhost:3000
```

## Test Scenarios

### Test 1: First Visit Experience
**Steps:**
1. Clear browser localStorage: `localStorage.clear()` in console
2. Refresh page
3. **Expected**: Purple cookie consent toast appears in top-right
4. **Verify**:
   - Message: "We use cookies to improve your experience. Do you accept cookies?"
   - Two buttons: "Accept" and "Decline"
   - Close button (X) visible
   - Progress bar counting down (30 seconds)

### Test 2: Accept Cookies
**Steps:**
1. Trigger Test 1 to show consent toast
2. Click "Accept" button
3. **Expected**: Page reloads automatically
4. Open console and run: `localStorage.getItem('__cookie_consent__')`
5. **Expected**: Returns `"true"`
6. **Verify**: Cookie consent toast does NOT reappear

### Test 3: Decline Cookies
**Steps:**
1. Clear localStorage: `localStorage.clear()`
2. Refresh page
3. Click "Decline" button
4. **Expected**: Toast closes WITHOUT page reload
5. Open console and run: `localStorage.getItem('__cookie_consent__')`
6. **Expected**: Returns `"false"`
7. Refresh page
8. **Verify**: Cookie consent toast does NOT reappear

### Test 4: Auto-Dismiss
**Steps:**
1. Clear localStorage: `localStorage.clear()`
2. Refresh page
3. Wait 30 seconds WITHOUT clicking any button
4. **Expected**: Toast slides out and disappears
5. **Verify**: Progress bar animates from full to empty
6. Refresh page
7. **Expected**: Toast appears again (no consent stored)

### Test 5: Manual Close
**Steps:**
1. Clear localStorage: `localStorage.clear()`
2. Refresh page
3. Click the X (close) button
4. **Expected**: Toast slides out immediately
5. Open console and run: `localStorage.getItem('__cookie_consent__')`
6. **Expected**: Returns `null`
7. Refresh page
8. **Expected**: Toast appears again

### Test 6: Cookie Storage Behavior
**Steps:**
1. Clear localStorage: `localStorage.clear()`
2. Refresh page and click "Accept"
3. After reload, open console
4. Run test function:
```javascript
// Import cookie utilities in console
import { testCookiesAvailable } from './utilities/cookie-utils';

// Test if cookies work
console.log('Cookies available:', testCookiesAvailable()); // Should be true
```

5. Now test decline:
```bash
localStorage.setItem('__cookie_consent__', 'false');
```
6. Refresh page
7. Run again:
```javascript
console.log('Cookies available:', testCookiesAvailable()); // Should be false
```

### Test 7: Multiple Toasts Stacking
**Steps:**
1. Accept cookies (to dismiss consent toast)
2. Open browser console
3. Run:
```javascript
// Trigger multiple test toasts
const { addToast } = window.toastContext; // Assuming you expose this for testing

addToast({ message: 'First toast', type: 'info', duration: 10000 });
addToast({ message: 'Second toast', type: 'success', duration: 10000 });
addToast({ message: 'Third toast', type: 'warning', duration: 10000 });
```
4. **Expected**: Three toasts stack vertically with 80px spacing
5. **Verify**: Each toast is fully visible, not overlapping

### Test 8: Mobile Responsive
**Steps:**
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M)
3. Select mobile device (e.g., iPhone 12)
4. Clear localStorage and refresh
5. **Expected**: Toast is full-width minus 10px margins on each side
6. **Verify**: Buttons are easily tappable, text is readable

### Test 9: Action Button Interaction
**Steps:**
1. Clear localStorage
2. Refresh to show consent toast
3. Hover over "Accept" button
4. **Expected**: Button shows hover state (darker blue)
5. Click "Accept"
6. **Expected**: 
   - onClick handler fires
   - Toast closes
   - Page reloads

### Test 10: Persistence Check
**Steps:**
1. Accept cookies
2. Close browser tab
3. Reopen application in new tab
4. **Expected**: No consent toast appears
5. Check localStorage: `localStorage.getItem('__cookie_consent__')`
6. **Expected**: Still returns `"true"`

## Console Utilities

### Manually Trigger Toast
```javascript
// Access toast context (add this to window in ToastContext for testing)
window.toastContext.success('Success message');
window.toastContext.error('Error message');
window.toastContext.warning('Warning message');
window.toastContext.info('Info message');

// Custom toast with actions
window.toastContext.addToast({
  message: 'Custom toast',
  type: 'info',
  duration: 5000,
  actions: [
    {
      label: 'Click Me',
      onClick: () => console.log('Action clicked!'),
      primary: true
    }
  ]
});
```

### Check Consent State
```javascript
// Check current consent
localStorage.getItem('__cookie_consent__');

// Force consent given
localStorage.setItem('__cookie_consent__', 'true');

// Force consent declined
localStorage.setItem('__cookie_consent__', 'false');

// Clear consent (trigger toast again)
localStorage.removeItem('__cookie_consent__');
```

## Known Behaviors

1. **Page reload on Accept**: This is intentional to ensure all components reinitialize with cookies enabled
2. **Toast reappears if closed without action**: Expected behavior - user hasn't made a choice
3. **localStorage used for consent**: Works even when cookies disabled/blocked
4. **30-second default duration**: Can be changed in CookieConsent component

## Debugging

### Toast Not Appearing
1. Check console for errors
2. Verify ToastProvider wraps App in App.jsx
3. Check if CookieConsent is imported and mounted
4. Clear localStorage and hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

### Cookies Not Working After Accept
1. Check browser console for errors during page reload
2. Verify localStorage shows `__cookie_consent__` as `"true"`
3. Run `testCookiesAvailable()` in console
4. Check browser settings - ensure cookies not blocked

### Action Buttons Not Working
1. Check console for onClick errors
2. Verify actions array structure: `[{label, onClick, primary?}]`
3. Ensure onClick is a function

## Performance Notes

- **Bundle size impact**: +1.38 kB JS, +566 B CSS
- **Runtime overhead**: Negligible - single useEffect on mount
- **Memory usage**: Minimal - one toast in memory at a time typically

## Next Steps After Testing

1. [ ] Verify all test scenarios pass
2. [ ] Test on multiple browsers (Chrome, Firefox, Safari, Edge)
3. [ ] Test on real mobile devices
4. [ ] Consider adding to E2E test suite
5. [ ] Monitor production analytics for consent rates
