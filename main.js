// import and create units required to draw the map
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { Icon, Style } from 'ol/style.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';

//start searching for user's location
getUserLocation();

//plot the map (full world)
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
	navigator.geolocation.getCurrentPosition(getLocationSuccess, getLocationFail, { enableHighAccuracy: false, maximumAge: 600000, timeout: 10000 });
}

function getLocationSuccess(position) {
	console.log('success');
	console.log(position);

	//zoom in and center to user's coords
	map.getView().setCenter(fromLonLat([position.coords.longitude, position.coords.latitude]));
	map.getView().setZoom(10);
	plotPoints([{ lon: position.coords.longitude, lat: position.coords.latitude }], true);

	//find nearest hospitals to the user
	getHospitalLocation(position.coords.latitude, position.coords.longitude, 3500, 350000, 3500, 5);
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

//find hospitals
function getHospitalLocation(userLatitude, userLongitude, radius, maximum, increment, numLocations) {
	if (radius > maximum) return 'fail';

	//queries and url for and of the api
	const query = `[out:json][timeout:30];
	(
  node["amenity"="hospital"](around:${radius},${userLatitude},${userLongitude});
	way["amenity"="hospital"](around:${radius},${userLatitude},${userLongitude});
	relation["amenity"="hospital"](around:${radius},${userLatitude},${userLongitude});
	);
  out;
	>;
	out;`;

	const url = `https://overpass-api.de/api/interpreter?data=${query}`;
	console.log(url);

	fetch(url)
		.then((res) => res.json())
		.then((res) => {
			console.log(res.elements.length);
			let calculatedNodes = 0;
			let neededNodes = [];
			for (var i = 0; i < res.elements.length; i++) {
				if (res.elements[i].tags) {
					neededNodes.push(calculatedNodes);
					calculatedNodes += res.elements[i].nodes ? res.elements[i].nodes.length : 1;
				} else if (i < numLocations) return getHospitalLocation(userLatitude, userLongitude, radius + increment, maximum, increment, numLocations); //just increasing search radius
				else break;
			}
			for (var i = 0; i < neededNodes.length; i++) {
				res.elements[i].lat = res.elements[neededNodes[i]].lat;
				res.elements[i].lon = res.elements[neededNodes[i]].lon;
				res.elements[i].distance = findHospitalDistance(userLatitude, userLongitude, res.elements[i].lat, res.elements[i].lon);
			}
			res.elements = res.elements.splice(0, neededNodes.length);
			res.elements.sort((a, b) => a.distance - b.distance);
			res.elements.slice(0, numLocations);
			plotPoints(res.elements, false);
		});
}

//radians to degrees
function rad(x) {
	return (x * Math.PI) / 180;
}

//uses Haversine's formula to calculate distance from 1 location to another given their coords, my tiny head hurts
function findHospitalDistance(lat1, lng1, lat2, lng2) {
	var R = 6371; // earth’s radius in meter
	var dLat = rad(lat2 - lat1);
	var dLong = rad(lng2 - lng1);
	var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLong / 2) * Math.sin(dLong / 2); // square of half the chord length between the two points
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); //angle between the two points
	var d = R * c; //the actual distabce
	return d;
}

//plot hospital points
function plotPoints(locations, userLocation) {
	locations.forEach((location) => {
		const markerStyle = new Style({
			image: new Icon({
				anchor: [0.5, 46],
				anchorXUnits: 'fraction',
				anchorYUnits: 'pixels',
				src: userLocation ? 'youAreHere.png' : 'hospitalMarker.png',
			}),
		});
		const marker = new Feature({
			geometry: new Point(fromLonLat([location.lon, location.lat])),
			tags: location.tags,
		});

		marker.setStyle(markerStyle);

		const vectorSource = new VectorSource({
			features: [marker],
		});

		const vectorLayer = new VectorLayer({
			source: vectorSource,
		});

		map.addLayer(vectorLayer);
	});
	map.on('click', (evt) => {
		const feature = map.forEachFeatureAtPixel(evt.pixel, (feature) => {
			return feature;
		});
		if (feature) {
			console.log(feature);
		}
	});
}
