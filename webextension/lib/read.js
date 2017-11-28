var template = document.querySelector('template');
var prefDiffList = document.querySelector('table#prefs');
var tileDiffList = document.querySelector('table#tiles');

zip.workerScriptsPath = '/lib/';

async function readZip(file) {
	async function getAsJSON(filename) {
		let file = entries.find(e => e.filename == filename);
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

	await Prefs.init();
	let prefs = await getAsJSON('prefs.json');
	// for (let [k, v] of Object.entries(prefs)) {
	// 	let current = Prefs[k];
	// 	if (['theme', 'opacity', 'rows', 'columns', 'spacing', 'titleSize', 'locked', 'history', 'recent'].includes(k)) {
	// 		if (v != current) {
	// 			let tr = template.content.firstElementChild.cloneNode(true);
	// 			tr.children[0].textContent = k;
	// 			tr.children[1].textContent = current;
	// 			tr.children[2].textContent = v;
	// 			prefDiffList.appendChild(tr);
	// 		}
	// 	} else if (k == 'margin') {
	// 		current = current.join(' ');
	// 		v = v.join(' ');
	// 		if (v != current) {
	// 			let tr = template.content.firstElementChild.cloneNode(true);
	// 			tr.children[0].textContent = k;
	// 			tr.children[1].textContent = current;
	// 			tr.children[2].textContent = v;
	// 			prefDiffList.appendChild(tr);
	// 		}
	// 	}
	// }
	browser.storage.local.set(prefs);

	let tiles = await getAsJSON('tiles.json');

	// function displayTile(tile, cell) {
	// 	if (!tile) {
	// 		return;
	// 	}

	// 	for (let k of ['title', 'position', 'backgroundColor', 'image']) {
	// 		if (tile[k]) {
	// 			let div = document.createElement('div');
	// 			div.textContent = k + ': ' + JSON.stringify(tile[k]);
	// 			cell.appendChild(div);
	// 		}
	// 	}
	// }

	// for (let t of tiles.sort((a, b) => a.url < b.url ? -1 : 1)) {
	// 	let tr = template.content.firstElementChild.cloneNode(true);
	// 	tr.children[0].textContent = t.url;
	// 	Tiles.getTile(t.url).then(ct => displayTile(ct, tr.children[1]));
	// 	displayTile(t, tr.children[2]);
	// 	tileDiffList.appendChild(tr);
	// }
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
	// console.log(tilesMap);

	await Tiles.clear();
	for (let t of tilesMap.values()) {
		await Tiles.putTile(t);
	}
}
