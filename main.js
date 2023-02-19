// import and create units required to draw the map
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj.js';

const view = new View({
	center: [0, 0],
	zoom: 2,
});

const map = new Map({
	target: 'map',
	layers: [
		new TileLayer({
			source: new OSM(),
		}),
	],
	view: view,
});

//get user location
let locationFail = false;
function getUserLocation() {
	console.log('trying to get location');
	navigator.geolocation.getCurrentPosition(getLocationSuccess, getLocationFail, { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 });
}

function getLocationSuccess(position) {
	console.log('success');
	console.log(position);

	map.getView().setCenter(fromLonLat([position.coords.longitude, position.coords.latitude]));
	map.getView().setZoom(13);
}

function getLocationFail(err) {
	console.log('fail');
	console.warn(err);
	if (err.code === err.TIMEOUT && !locationFail) {
		console.log('failed to get location, retrying');
		locationFail = true;
		setTimeout(getUserLocation, 1000);
	} else {
		alert('location get failed');
	}
}

getUserLocation();
