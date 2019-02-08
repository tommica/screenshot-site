// snapshot.js

const url = require('url');
const puppeteer = require('puppeteer');
const parser = require('fast-xml-parser');
const fs = require('fs');
const jsonPages = parser.parse( (fs.readFileSync('sitemap.xml', 'utf8')) );
const pages = jsonPages['urlset']['url'] || [];

async function doScreenCapture(url_href, site_name) {
	const browser = await puppeteer.launch({
		defaultViewport: {
			width: 1920,
			height: 1080
		}
	});
	const page = await browser.newPage();
	await page.goto(url_href);
	await page.evaluate( () => {
		window.scrollTo(0,document.body.scrollHeight);
	});
	await page.waitFor(5000);
	await page.screenshot({
		fullPage: true,
		path:`shots/${site_name}.png`,
		type: 'png'
	});
	await browser.close();
}

async function doPageLoads() {
	for(let x = 0; x < pages.length; x++) {
		let parsedUrl = url.parse(pages[x]['loc']);
		let name = parsedUrl.path.replace(/\//g, '');

		await doScreenCapture(parsedUrl.href, name);
	}
}

doPageLoads();