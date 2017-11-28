/* globals Background, Tiles, chrome, zip */
/* exported makeZip, readZip */
zip.workerScriptsPath = '/lib/';

async function makeZip() {
	async function addEntry(filename, content) {
		let reader = content instanceof Blob ? new zip.BlobReader(content) : new zip.TextReader(content);
		return new Promise(function(resolve) {
			writer.add(filename, reader, resolve);
		});
	}

	let writer = await new Promise(function(resolve, reject) {
		zip.createWriter(new zip.BlobWriter(), resolve, reject);
	});

	let background = await Background.getBackground();
	if (background) {
		await addEntry('background', background);
	}

	let prefs = await new Promise(function(resolve) {
		chrome.storage.local.get(resolve);
	});
	for (let k of ['thumbnailSize', 'version', 'versionLastUpdate', 'versionLastAck']) {
		delete prefs[k];
	}
	await addEntry('prefs.json', JSON.stringify(prefs, null, '\t'));

	let tiles = await Tiles.getAll();
	for (let t of tiles) {
		if ('image' in t && t.image instanceof Blob) {
			await addEntry('tileImages/' + t.id + '.png', t.image);
			delete t.image;
		}
	}
	await addEntry('tiles.json', JSON.stringify(tiles, null, '\t'));

	await new Promise(function(resolve) {
		writer.close(function(blob) {
			// blob contains the zip file as a Blob object
			chrome.downloads.download({
				url: URL.createObjectURL(blob),
				filename: 'zip.zip',
				saveAs: true
			}, resolve);
		});
	});
}

async function readZip(file) {
	async function getAsJSON(filename) {
		let file = entries.find(e => e.filename == filename);
		if (!file) {
			return null;
		}

		let data = await new Promise(function(resolve) {
			file.getData(new zip.TextWriter(), resolve);
		});
		return JSON.parse(data);
	}

	async function getAsBlob(file) {
		return new Promise(function(resolve) {
			file.getData(new zip.BlobWriter(), resolve);
		});
	}

	let reader = await new Promise(function(resolve, reject) {
		zip.createReader(new zip.BlobReader(file), resolve, reject);
	});

	let entries = await new Promise(function(resolve) {
		reader.getEntries(resolve);
	});

	let backgroundFile = entries.find(e => e.filename == 'background');
	if (backgroundFile) {
		Background.setBackground(await getAsBlob(backgroundFile));
	}

	let prefs = await getAsJSON('prefs.json');
	if (prefs) {
		await chrome.storage.local.set(prefs);
	}

	let tiles = await getAsJSON('tiles.json');
	if (!tiles) {
		return;
	}

	let tilesMap = new Map();
	for (let t of tiles) {
		tilesMap.set(t.id, t);
	}
	for (let e of entries) {
		if (e.filename.startsWith('tileImages/')) {
			let id = parseInt(e.filename.substring(11), 10);
			let image = await getAsBlob(e);
			tilesMap.get(id).image = image;
		}
	}

	await Tiles.clear();
	for (let t of tilesMap.values()) {
		await Tiles.putTile(t);
	}
}
