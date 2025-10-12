/**
 * Puppeteer Test Script for Biensperience UI
 * Tests login flow and checks for jarring UI transitions
 */

const puppeteer = require('puppeteer');

const TEST_CREDENTIALS = {
  email: 'goke.pelemo+test@gmail.com',
  password: 'testpassword123'
};

const BASE_URL = 'http://127.0.0.1:3001';

// Helper to wait for navigation and animations
async function waitForPageLoad(page) {
  await page.waitForNetworkIdle({ timeout: 5000 });
  await new Promise(resolve => setTimeout(resolve, 500)); // Wait for animations
}

// Helper to take screenshots
async function takeScreenshot(page, name) {
  await page.screenshot({
    path: `screenshots/test-${name}.png`,
    fullPage: true
  });
  console.log(`📸 Screenshot saved: test-${name}.png`);
}

// Check for layout shifts
async function detectLayoutShifts(page) {
  const shifts = await page.evaluate(() => {
    return new Promise((resolve) => {
      let shifts = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            shifts.push({
              value: entry.value,
              time: entry.startTime
            });
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
      
      setTimeout(() => {
        resolve(shifts);
      }, 2000);
    });
  });
  
  const totalShift = shifts.reduce((sum, shift) => sum + shift.value, 0);
  return { shifts, totalShift };
}

// Main test function
async function runUITest() {
  console.log('🚀 Starting Biensperience UI Test...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI/CD
    slowMo: 50, // Slow down by 50ms to observe
    args: [
      '--window-size=1920,1080',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Enable console logging from the page
  page.on('console', msg => console.log('   PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('   PAGE ERROR:', error.message));
  
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };
  
  try {
    // ============================================
    // TEST 1: Home Page Load
    // ============================================
    console.log('📝 TEST 1: Loading home page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await waitForPageLoad(page);
    
    const layoutShifts = await detectLayoutShifts(page);
    if (layoutShifts.totalShift > 0.1) {
      results.warnings.push(`Home page has layout shift score of ${layoutShifts.totalShift.toFixed(3)} (should be < 0.1)`);
    } else {
      results.passed.push('Home page has minimal layout shifts');
    }
    
    await takeScreenshot(page, '01-home-page');
    
    // ============================================
    // TEST 2: Navigate to Login
    // ============================================
    console.log('📝 TEST 2: Navigating to login page...');
    
    // Look for "Sign In" button/link
    let loginButton = null;
    
    // Try finding by text content (case-insensitive)
    const links = await page.$$('a, button');
    for (const link of links) {
      const text = await link.evaluate(el => el.textContent.trim().toLowerCase());
      if (text === 'sign in' || text === 'log in' || text === 'login') {
        loginButton = link;
        console.log(`   Found login link with text: "${await link.evaluate(el => el.textContent.trim())}"`);
        break;
      }
    }
    
    if (!loginButton) {
      results.warnings.push('Login button not found - trying direct navigation');
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
      await waitForPageLoad(page);
      await takeScreenshot(page, '02-login-page');
      results.passed.push('Navigated directly to login page');
    } else {
      await loginButton.click();
      await waitForPageLoad(page);
      await takeScreenshot(page, '02-login-page');
      results.passed.push('Successfully clicked "Sign In" button to navigate to login page');
    }
    
    // ============================================
    // TEST 3: Form Field Interactions
    // ============================================
    console.log('📝 TEST 3: Testing form field interactions...');
    
    const emailInput = await page.$('input[type="email"], input[name="email"]');
    const passwordInput = await page.$('input[type="password"], input[name="password"]');
    
    if (!emailInput || !passwordInput) {
      results.failed.push('Login form fields not found');
    } else {
      // Test email input with smooth transitions
      await emailInput.click();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Check if focus state is applied
      const hasFocusState = await emailInput.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.borderColor !== 'rgb(206, 212, 218)'; // Default border color
      });
      
      if (hasFocusState) {
        results.passed.push('Email input has proper focus state');
      } else {
        results.warnings.push('Email input focus state may not be visible');
      }
      
      // Type email slowly to observe transitions
      await emailInput.type(TEST_CREDENTIALS.email, { delay: 50 });
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await passwordInput.click();
      await passwordInput.type(TEST_CREDENTIALS.password, { delay: 50 });
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await takeScreenshot(page, '03-form-filled');
      results.passed.push('Form fields filled successfully');
    }
    
    // ============================================
    // TEST 4: Form Submission
    // ============================================
    console.log('📝 TEST 4: Submitting login form...');
    
    const submitButton = await page.$('button[type="submit"]');
    if (!submitButton) {
      results.failed.push('Submit button not found');
    } else {
      // Click submit and wait for response
      await submitButton.click();
      
      // Wait for either navigation or error message
      try {
        await Promise.race([
          page.waitForNavigation({ timeout: 10000 }),
          page.waitForSelector('.alert', { timeout: 10000 }),
          page.waitForSelector('.alert-danger', { timeout: 10000 }),
          new Promise(resolve => setTimeout(resolve, 10000))
        ]);
      } catch (err) {
        console.log('   Navigation/error wait completed');
      }
      
      await waitForPageLoad(page);
      await takeScreenshot(page, '04-after-login');
      
      // Check if we're logged in by looking for multiple indicators
      const currentUrl = page.url();
      console.log(`   Current URL: ${currentUrl}`);
      
      // Check if URL changed away from login page
      const isOnLoginPage = currentUrl.includes('/login') || currentUrl.includes('/auth');
      
      // Check for user dropdown (indicates logged in state)
      const userDropdown = await page.$('.dropdown-toggle');
      const hasUserDropdown = userDropdown !== null;
      
      // Check for error message
      const errorMessage = await page.$eval('.alert-danger, .alert', el => el.textContent).catch(() => null);
      
      if (!isOnLoginPage && hasUserDropdown) {
        results.passed.push('✅ Successfully logged in! User dropdown found and redirected from login page');
        console.log('   ✅ Login successful - user authenticated');
      } else if (!isOnLoginPage) {
        results.passed.push('Redirected from login page (likely successful login)');
        console.log('   URL changed from login page');
      } else if (errorMessage) {
        results.warnings.push(`Login attempt response: ${errorMessage.trim()}`);
        console.log(`   Error message: ${errorMessage.trim()}`);
      } else {
        results.warnings.push('Still on login page - credentials may be invalid or server may be down');
        console.log('   Still on login page, no error message visible');
      }
    }
    
    // ============================================
    // TEST 5: Navigation Smoothness
    // ============================================
    console.log('📝 TEST 5: Testing navigation smoothness...');
    
    const navLinks = await page.$$('nav a, .nav-link');
    if (navLinks.length > 0) {
      console.log(`   Found ${navLinks.length} navigation links`);
      
      // Test first 3 nav links
      for (let i = 0; i < Math.min(3, navLinks.length); i++) {
        const link = navLinks[i];
        const linkText = await link.evaluate(el => el.textContent);
        
        console.log(`   Testing link: ${linkText}`);
        await link.click();
        await waitForPageLoad(page);
        
        const shifts = await detectLayoutShifts(page);
        if (shifts.totalShift > 0.1) {
          results.warnings.push(`"${linkText}" page has layout shift: ${shifts.totalShift.toFixed(3)}`);
        }
      }
      
      results.passed.push('Navigation links tested');
    }
    
    await takeScreenshot(page, '05-final-state');
    
  } catch (error) {
    results.failed.push(`Test error: ${error.message}`);
    console.error('❌ Error during test:', error);
  } finally {
    // ============================================
    // TEST RESULTS
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(60) + '\n');
    
    console.log('✅ PASSED (' + results.passed.length + '):');
    results.passed.forEach(msg => console.log('   ✓', msg));
    
    if (results.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (' + results.warnings.length + '):');
      results.warnings.forEach(msg => console.log('   ⚠', msg));
    }
    
    if (results.failed.length > 0) {
      console.log('\n❌ FAILED (' + results.failed.length + '):');
      results.failed.forEach(msg => console.log('   ✗', msg));
    }
    
    console.log('\n' + '='.repeat(60));
    
    const totalTests = results.passed.length + results.warnings.length + results.failed.length;
    const successRate = ((results.passed.length / totalTests) * 100).toFixed(1);
    console.log(`\n📈 Success Rate: ${successRate}% (${results.passed.length}/${totalTests})`);
    console.log('🎬 Test complete! Check screenshots/ folder for visual results.\n');
    
    await browser.close();
    
    // Exit with appropriate code
    process.exit(results.failed.length > 0 ? 1 : 0);
  }
}

// Run the test
runUITest();
