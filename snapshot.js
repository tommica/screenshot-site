// snapshot.js

const url = require('url');
const puppeteer = require('puppeteer');
const parser = require('fast-xml-parser');
const fs = require('fs');
const jsonPages = parser.parse( (fs.readFileSync('sitemap.xml', 'utf8')) );
const pages = jsonPages['urlset']['url'] || [];

async function doScreenCapture(url_href, site_name) {
	// STart the browser in full-hd size
	const browser = await puppeteer.launch({
		defaultViewport: {
			width: 1920,
			height: 1080
		}
	});

	// Open a new tab
	const page = await browser.newPage();

	// Navigate to given url
	await page.goto(url_href);

	// Scroll to bottom, to make sure all contents are lazy loaded if need be
	await page.evaluate( () => {
		window.scrollTo(0,document.body.scrollHeight);
	});

	// Wait for animations to finish
	await page.waitFor(5000);

	// Take a screenshot of the page
	await page.screenshot({
		fullPage: true,
		path:`shots/${site_name}.png`,
		type: 'png'
	});

	// Close the browser
	await browser.close();
}

async function doPageLoads() {
	// Loop through each page
	for(let x = 0; x < pages.length; x++) {
		let parsedUrl = url.parse(pages[x]['loc']);
		let name = parsedUrl.path;

		// Handle frontpages
		if(name === '/') {
			name = 'frontpage';
		} else {
			name = name.replace(/\//g, '');
		}

		// Do the screenshot
		await doScreenCapture(parsedUrl.href, name);
	}
}

// Start the main functionality
doPageLoads();