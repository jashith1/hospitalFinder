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
import Overlay from 'ol/Overlay';

document.querySelector('#status button').onclick = getUserLocation;
const statusDiv = document.getElementById('status');
const statusText = document.querySelector('#status h3');
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
	if (!document.querySelector('#status img')) {
		const image = document.createElement('img');
		image.src = 'https://media.tenor.com/On7kvXhzml4AAAAj/loading-gif.gif';
		image.width = 25;
		image.height = 25;
		statusDiv.append(image);
	}
	if (document.querySelector('#status button')) document.querySelector('#status button').remove();
	statusText.innerText = 'finding location, please be patient this could take up to 30 seconds.';
	navigator.geolocation.getCurrentPosition(getLocationSuccess, getLocationFail, { enableHighAccuracy: false, maximumAge: 360000, timeout: 10000 });
}

function getLocationSuccess(position) {
	if (document.querySelector('#status img')) document.querySelector('#status img').remove();
	statusText.innerText = 'found location';
	// statusDiv.innerHTML = '';
	console.log(position);

	//zoom in and center to user's coords
	map.getView().setCenter(fromLonLat([position.coords.longitude, position.coords.latitude]));
	map.getView().setZoom(10);
	plotPoints([{ lon: position.coords.longitude, lat: position.coords.latitude }], true);

	//find nearest hospitals to the user
	statusText.innerText = 'finding hospitals...';
	getHospitalLocation(position.coords.latitude, position.coords.longitude, 3500, 350000, 3500, 5);
}

function getLocationFail(err) {
	statusText.innerText = 'failed to find location';
	console.log('fail');
	console.warn(err);
	if (err.code === err.TIMEOUT && !locationFail) {
		console.log('failed to get location, retrying');
		locationFail = true;
		setTimeout(getUserLocation, 1000);
	} else {
		alert('failed to get location, please refresh and try again');
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

	fetch(url)
		.then((res) => res.json())
		.then((res) => {
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
	statusText.innerText = 'plotting hospitals...';

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
		if (userLocation) return;

		const locationPopup = new Overlay({
			element: document.createElement('div'),
			autoPan: true,
			autoPanAnimation: {
				duration: 250,
			},
			offset: [10, -10],
		});

		map.addOverlay(locationPopup);

		map.on('pointermove', getFeatureInfo);
		map.on('click', getFeatureInfo);

		function getFeatureInfo(event) {
			const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f);
			let result = '';
			if (feature === marker) {
				Object.keys(feature.values_.tags).forEach((tag) => {
					result += tag + ': ' + feature.values_.tags[tag] + '\n';
				});
				const popupContent = document.createElement('div');
				popupContent.classList.add(event.type === 'pointermove' ? 'popup' : 'hospital-info');
				popupContent.innerText = result;
				if (event.type === 'pointermove') {
					const coordinate = event.coordinate;
					locationPopup.setElement(popupContent);
					locationPopup.setPosition(coordinate);
				} else if (event.type === 'click') {
					const featureInfoDiv = document.getElementById('featureInfo');
					featureInfoDiv.innerHTML = '';
					featureInfoDiv.appendChild(popupContent);
				}
			} else {
				locationPopup.setElement(document.createElement('div'));
			}
		}
	});
	statusText.innerText = 'Done!';
}
