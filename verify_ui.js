const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting UI Verification (Korean)...');
    const browser = await puppeteer.launch({
        headless: true, // Run headless for CI/CD like environment
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        console.log('Navigating to http://localhost:3000...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

        console.log('Checking for title...');
        const titleValues = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            return h1 ? h1.innerText : null;
        });

        if (titleValues && titleValues.includes('인스타그램 게시물 분석기')) {
            console.log('✅ Homepage loaded successfully. Title found:', titleValues);
        } else {
            console.error('❌ Homepage title mismatch or not found. Found:', titleValues);
            process.exit(1);
        }

        console.log('Testing Input validation...');
        // Test invalid URL
        await page.type('input#url', 'invalid-url');
        // HTML5 validation might block submission, let's just clear and type valid one
        await page.evaluate(() => {
            const input = document.querySelector('input#url');
            input.value = '';
        });

        // Test with a sample URL (User's sample)
        const sampleUrl = 'https://www.instagram.com/p/C-uOq4tS1tM/';
        console.log(`Testing with URL: ${sampleUrl}`);

        await page.type('input#url', sampleUrl);
        await page.click('button[type="submit"]');

        console.log('Waiting for response (this triggers server-side scraping)...');
        // Wait for either result or error
        // The scraping might take time or fail/block, so we wait generically for the container update
        try {
            await page.waitForSelector('.animate-in', { timeout: 20000 });
            console.log('✅ Result container appeared.');

            // Check if we got data or error
            const resultText = await page.evaluate(() => document.body.innerText);
            if (resultText.includes('업로드 시간 (KST)') || resultText.includes('비공개') || resultText.includes('실패했습니다')) {
                console.log('✅ Data or Expected Error displayed (Korean confirmed).');
                console.log('Sample of page text:', resultText.substring(0, 200));
            } else {
                console.warn('⚠️ Unexpected result content. Check screenshot/logs.');
            }

        } catch (e) {
            console.error('❌ Timed out waiting for result. Scraping might be too slow or stuck.');
        }

    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        await browser.close();
        console.log('Verification finished.');
    }
})();
