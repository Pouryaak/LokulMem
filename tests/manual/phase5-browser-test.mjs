#!/usr/bin/env node
/**
 * Simple browser test using Puppeteer
 */

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, '../..');

console.log('🧪 Phase 5 Browser Tests\n');
console.log('Building project...');
execSync('npm run build', { stdio: 'inherit', cwd: ROOT });

async function runTests() {
  console.log('\n🌐 Launching browser...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Listen for console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.log(`  ❌ Console Error: ${text}`);
    } else if (type === 'warning') {
      console.log(`  ⚠️  Console Warning: ${text}`);
    } else if (type === 'log') {
      console.log(`  📝 ${text}`);
    }
  });

  // Listen for page errors
  page.on('pageerror', error => {
    console.log(`  💥 Page Error: ${error.message}`);
  });

  try {
    console.log('\n📄 Loading test page...');
    await page.goto('file://' + join(ROOT, 'tests/manual/phase5-manual-test.html'), {
      waitUntil: 'networkidle0',
      timeout: 10000
    });

    console.log('✅ Test page loaded\n');
    console.log('⏳ Running tests... (this may take 30+ seconds for model loading)\n');

    // Click run button
    await page.click('#runAllBtn');

    // Wait for tests to complete (with timeout for model loading)
    await page.waitForFunction(
      () => {
        const btn = document.getElementById('runAllBtn');
        return btn && !btn.disabled;
      },
      { timeout: 60000 }
    );

    // Give it a moment to update UI
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get results
    const totalTests = await page.$eval('#totalTests', el => el.textContent);
    const passedTests = await page.$eval('#passedTests', el => el.textContent);
    const failedTests = await page.$eval('#failedTests', el => el.textContent);

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Test Results: ${passedTests}/${totalTests} passed`);
    console.log('='.repeat(50));

    // Get detailed results
    const testCases = await page.$$eval('.test-case', cases => {
      return cases.map(c => {
        const statusSpan = c.querySelector('.status');
        const status = statusSpan ? statusSpan.className.split(' ')[1] : 'unknown';
        const name = c.querySelector('strong')?.textContent || 'Unknown';
        const desc = c.querySelector('div:nth-child(2)')?.textContent || '';
        const output = c.querySelector('.output')?.textContent || '';
        return { status, name, desc, output };
      });
    });

    // Show failed tests
    const failed = testCases.filter(t => t.status === 'fail');
    if (failed.length > 0) {
      console.log('\n❌ Failed Tests:');
      failed.forEach(t => {
        console.log(`  • ${t.name}: ${t.desc}`);
        if (t.output) {
          console.log(`    ${t.output.substring(0, 200)}...`);
        }
      });
    }

    // Show passed tests (summary only)
    const passed = testCases.filter(t => t.status === 'pass');
    console.log(`\n✅ Passed: ${passed.length} tests`);

    await browser.close();

    if (parseInt(failedTests) > 0) {
      process.exit(1);
    } else {
      console.log('\n✨ All browser tests passed!');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await browser.close();
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
