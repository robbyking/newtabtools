zip.workerScriptsPath = '/lib/';

async function getContents() {
	let zipContents = new Map();
	let background = await Background.getBackground();
	if (background) {
		zipContents.set('background', background);
	}

	let prefs = await browser.storage.local.get();
	for (let k of ['thumbnailSize', 'version', 'versionLastUpdate', 'versionLastAck']) {
		delete prefs[k];
	}
	zipContents.set('prefs.json', JSON.stringify(prefs, null, '\t'));

	let tiles = await new Promise(function(resolve) {
		db.transaction('tiles').objectStore('tiles').getAll().onsuccess = function() {
			resolve(this.result);
		};
	});
	zipContents.set('tiles.json', JSON.stringify(tiles, null, '\t'));
	for (let t of tiles) {
		if ('image' in t && t.image instanceof Blob) {
			zipContents.set('tileImages/' + t.id + '.png', t.image);
		}
	}

	return zipContents;
}

async function makeZip() {
	let zipContents = await getContents();

	let writer = await new Promise(function(resolve, reject) {
		zip.createWriter(new zip.BlobWriter(), resolve, reject);
	});
	for (let [name, entry] of zipContents.entries()) {
		let reader = entry instanceof Blob ? new zip.BlobReader(entry) : new zip.TextReader(entry);
		await new Promise(function(resolve, reject) {
			writer.add(name, reader, resolve, reject);
		});
	}

	writer.close(function(blob) {
		// blob contains the zip file as a Blob object
		browser.downloads.download({
			url: URL.createObjectURL(blob),
			filename: 'zip.zip',
			saveAs: true
		});
	});
}
