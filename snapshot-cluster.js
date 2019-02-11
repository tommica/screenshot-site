// snapshot-cluster.js

const cluster = require('cluster');
const url = require('url');
const puppeteer = require('puppeteer');
const parser = require('fast-xml-parser');
const fs = require('fs');
const jsonPages = parser.parse( (fs.readFileSync('sitemap.xml', 'utf8')) );
const pages = jsonPages['urlset']['url'] || [];
const numCPUs = require('os').cpus().length;

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

if(cluster.isMaster) {
	// Just be aware, some webhosts do not like multiple loads, so you might want to limit the amount of cores
	const cores = numCPUs;

	// Start the processes
	for(let i = 0; i < cores; i++) {
		let worker = cluster.fork();

		// Attach messaging functionality
		worker.on('message', (msg) => {
			objMsg = {};
	
			// Process wants a new job
			if(msg.type === 'new_job_wanted') {
				// Get a new url from the stack
				let newUrl = pages.pop();
	
				// if there is url to load, do it
				if(newUrl) {
					objMsg.type = 'new_job';
					objMsg.url = newUrl['loc'];
				} else {
					// No more pages, tell the worker to exit
					objMsg.type = 'exit';	
				}
			} else if(msg.type === 'restart_job') {
				// If the worker tells that something failed, just restart it
				let newUrl = msg.url;
				objMsg.type = 'new_job';
				objMsg.url = newUrl;
			}
	
			worker.send(objMsg);
		});
	}

	// Restart forks when they die unexpected
	cluster.on('exit', (worker, code, signal) => {
		if(code !== 0) {
			cluster.fork();
		}
	});
} else {
	// Handle messaging between master and worker
	process.on('message', (msg) => {
		if(msg.type === 'exit') {
			process.exit(0);
		} else if(msg.type === 'new_job') {
			let newUrl = msg.url;
			let parsedUrl = url.parse(newUrl);
			let name = parsedUrl.path;

			// Handle frontpages
			if(name === '/') {
				name = 'frontpage';
			} else {
				name = name.replace(/\//g, '');
			}

			// Do the screen capture
			doScreenCapture(parsedUrl.href, name).then(() => {
				// On a succesful load, get a new job
				process.send({'type': 'new_job_wanted'});
			}).catch(() => {
				// Error, restart job
				process.send({
					'type': 'restart_job',
					'url': newUrl,
				});
			});
		}
	});

	// Initialize the worker
	process.send({'type': 'new_job_wanted'});
}