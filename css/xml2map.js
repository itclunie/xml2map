//instead of 2 separate branches of table data and popup/marker data instead
window.onload = function() {
		var fileInput = document.getElementById('fileInput');

		fileInput.addEventListener('change', function(e) {
			var file = fileInput.files[0];
			var textType = /text.*/;

			if (file.type.match(textType)) {
				var reader = new FileReader();

				reader.onload = function(e) {
					xmlParse(reader.result);
				}

				reader.readAsText(file);	
			} 
		});
}

function obj2str(obj){ //turns an object into a string of course
	myStr = "";
	var keysVals = Object.entries(obj);
	for (var i in keysVals){
		var key = keysVals[i][0]
		var val = keysVals[i][1]
		if(val != ""){
			myStr = myStr + key + ":" + val + ";  "
		};
	};
	return myStr;
};

function renameDupes(arr){ //finds dupes in an array, renames them with an incrementing number
	var counts = {}
	for(var i in arr){
		if(!counts[arr[i]])
			counts[arr[i]]=0;
		counts[arr[i]]++;
	}
	arr = [];
	for(var name in counts){
		for(var i=0;i<counts[name];i++){
			arr.push(name+(i===0?'':'__'+i));
		}
	}
	return arr;
};
 
 
function xmlParse(xml) { //parses xml from data directory
	var xmlDoc = $.parseXML(xml);
    var x2js = new X2JS();
    var jsonObj = x2js.xml2json(xmlDoc); // Convert XML to JSON
    
	for (var k in jsonObj['LOL']){
		var feature = jsonObj['LOL'][k];
		for (var j in feature){
			console.log(feature[j]);
		};
		
		console.log(breakplz)
	}
	

	
	
	
	//var xmlDoc = xml.responseXML.activeElement.children;
	var xmlArray = []; //array that holds all the point features (ie xmlCoordsObj)
	var allPossFields = new Map(); //since some tags have same names but diff values, we collect all possible names and then number the dupes
	
	for (var k in xmlDoc) {  //for each feature in XML
		var xmlCoordsObj = [{"lon":null, "lat":null}, []]; // looks like: [ {'lat':__, 'lon':__}, [attribute data array] ]
		var possFields = []
		
		for (var j in xmlDoc[k].children) { //for each tag in that feature
			XMLtag = xmlDoc[k].children[j]
			XMLtagKey = XMLtag.localName;
			possFields.push(XMLtagKey);
			
			if(XMLtagKey == "Latitude"){ //filling xmlCoordsObj[0] with coord data
				xmlCoordsObj[0]["lat"] = parseFloat(XMLtag.innerHTML);
			} else if(XMLtagKey == "Longitude"){
				xmlCoordsObj[0]["lon"] = parseFloat(XMLtag.innerHTML);
			};
			
			if(XMLtag.childElementCount == 0){ //filling xmlCoordsObj[1] with attribute data
				xmlCoordsObj[1].push([XMLtagKey, XMLtag.innerHTML]);
			} else { //some tags have object values. parses those
				var xmlTagDict = {};
				for (var i in XMLtag.children) { //for each child in that tag
					XMLsubTag = XMLtag.children[i];
					if(typeof(XMLsubTag.localName) != "undefined"){
						xmlTagDict[XMLsubTag.localName] = XMLsubTag.innerHTML
					};
				};
				xmlCoordsObj[1].push([XMLtagKey, xmlTagDict]);
			};
		};
		xmlArray.push(xmlCoordsObj);
		
		renamedFields = renameDupes(possFields); //collecting all the possible fields. renaming dupes
		for (var f in renamedFields){
			if(renamedFields[f].includes("undefined") == false){
				allPossFields[renamedFields[f]] = null;
			};
		};
	};
	initmap(xmlArray, allPossFields); //passes the parsed xml and all possible fields 
};

function makeRow(xmlFeat, allPossFields) { //initialized by displayMarkers(), makeRow() takes user's bbox selection as array turns it into a row that can be fed into populateTable()
	var countrDict = {'Range':0, 'Characteristic':0, 'HeightofLight':0, 'CharacteristicRemarks':0}; //counter for those crappy input xml fields that are same name but have diff values
	var rowDict = _.clone(allPossFields); //make duplicate of allPossFields
	var tableRow = [];
	
	for (var j in xmlFeat) { //grab all the text from xmlfeat
		var key = xmlFeat[j][0]
		var value = xmlFeat[j][1]
		if(typeof(key) != "undefined"){
			tableRow.push([key, value])
		};
	};
	
	for (var p in tableRow){ //here we have to match up this particular marker/row's headers with allPossFields
		var key = tableRow[p][0];
		
		if(typeof(tableRow[p][1]) != "string"){ //if it's one of those values that's an obj like range, characteristic, etc., turn into string
			var value = obj2str(tableRow[p][1]);
		}else{
			var value = tableRow[p][1];
		};
		
		if(rowDict[key] == null){ //matching
			rowDict[key] = value;
		}else{
			countrDict[key] += 1; //because we have some headers with the same name but diff values, we have to differentiate
			rowDict[key + "__" + String(countrDict[key])] = value;
		};
	};
	return rowDict;
}; 

function makePopup(xmlFeat) { //creates html 4 marker popup
	var popup = "<style>ul { margin-top:0px; margin-bottom:0px; } </style>";
	for (var j in xmlFeat) {
		var key = xmlFeat[j][0]
		var value = xmlFeat[j][1]
		var keyArray = Object.keys(value);
		if(xmlFeat[j][1].length > 0){
			popup = popup + "<div><b>" + key + "</b> : " + value + "</div>"
			
		}else if(typeof(value) != "string" && Object.keys(value).length > 0){
			var subPopup = "";
			for (keyNum in keyArray){
				var subKey = keyArray[keyNum]
				var subVal = xmlFeat[j][1][subKey]
				if(subKey != "undefined" && subVal.length > 0){
					subPopup = subPopup + "<li>" + subKey + " : " + subVal + "</li>"
				};
			};
			popup = popup + "<div><b>" + key + "</b> : <ul>" + subPopup + "</ul></div>"
		};
	};
	return popup;
}; 

function isMarkerInsidePolygon(marker, poly) { //checks if any of the xml features are in user's bbox 
	var polyPoints = poly._latlngs[0];    
	var x = marker.getLatLng().lat, y = marker.getLatLng().lng;
	var inside = false;
	for (var i = 0, j = polyPoints.length - 1; i < polyPoints.length; j = i++) {
		var xi = polyPoints[i].lat, yi = polyPoints[i].lng;
		var xj = polyPoints[j].lat, yj = polyPoints[j].lng;
		
		var intersect = ((yi > y) != (yj > y))
			&& (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
		if (intersect) inside = !inside;
	}
	return inside;
};

function clearMarkers(markers){
	markers.clearLayers();
};	

function initmap(xmlArray,allPossFields) { //displays leaflet map
	var map = L.map('map').setView([20, 0], 3);
	//var map = L.map('map').setView([59.0605832858731, 11.1560555826757], 9);
	var countr = 0; //selection counter
	var markers = new L.FeatureGroup();
	var smlIcon = new L.Icon({iconUrl:'marker-icon-blue.png',iconSize:[15,20],iconAnchor:[7.5,20],popupAnchor:[0,-15]}); //marker icon 
	var table_control = new L.control.Table({}).addTo(map) //popup table control. filled in populateTable()
	
	function displayMarkers(data,markers,poly,inIcon){ //once a bbox/shape is drawn displayMarkers() is initialized. its job is to check if markers in user's bbox(isMarkerInsidePolygon), give markers popups (makePopup), prep data for table display (makeRow) and display table of markers in bbox (populateTable)
		var tableData = [];
		for (var i in data) { //add all markers to map
			if(data[i][1].length > 0){
				var latlon = [data[i][0]["lat"], data[i][0]["lon"]]

				marker = L.marker(latlon, {icon: inIcon});
				if(isMarkerInsidePolygon(marker,poly) == true){ //check if marker is inside, if not dont display
					popup = makePopup(data[i][1]); //make html 4 popup
					marker.bindPopup(popup); //html popup
					markers.addLayer(marker);
					row = makeRow(data[i][1], allPossFields); //table row
					tableData.push(row); 				
				};
			};
		};
		markers.addTo(map);
		populateTable(tableData, markers); //populate table with same data as used for markers
	};
	
	function populateTable(bboxRows, markers){ //fills the table_control var with a table of rows that fall within user's bbox 
		if(bboxRows.length > 0 && bboxRows.length < 200){ //if no points in bbox dont make table. 200 row cutoff (otherwise takes forever to load)
			countr += 1;
			var table = new Supagrid({
				id_field: 'AidNo',
				fields: Object.keys(bboxRows[0]).sort(),
				data: bboxRows
			});
			
			table_control.addTable(table.supagrid, "rel_" + String(countr), "Selection_" + String(countr)); // add to the control
			
		}else if(bboxRows.length !== 0){
			countr += 1;
			var table = new Supagrid({
				id_field: 'AidNo',
				fields: Object.keys(bboxRows[0]).sort(),
				data: bboxRows.slice(0,200)
			});
			
			table_control.addTable(table.supagrid, "rel_" + String(countr), "Selection_" + String(countr)); // add to the control		
		};
	};
	
	var GJ = new L.GeoJSON.AJAX("data/worldCoastline.geojson", {clickable:false, style:{stroke:true, color:'#E74E3C', weight:1, fill:false}}) //bring in static basemap
	
	var drawnItems = L.featureGroup().addTo(map); 
	
	var drawnLayers = L.control.layers( //leaflet.draw options
		{'coastline basemap': GJ.addTo(map)}, 
		{ 'drawn shape': drawnItems }, 
		{ position: 'topleft', collapsed: true }
	).addTo(map);
	
	map.addControl(new L.Control.Draw({ //controls what's displayed in the interface
		edit: 
		{
			featureGroup: drawnItems,
			edit: false
		},
		draw: 
		{
			polygon: {allowIntersection: false, showArea:true }, //only allow polygons to be drawn. within functions dont work well with circles
			circle: false,
			marker: false,
			circlemarker: false
		}
	}));

	map.on(L.Draw.Event.CREATED, function (event) { //listener for when user draws shape
		clearMarkers(markers)
		drawnItems.clearLayers();
		var layer = event.layer;
		drawnItems.addLayer(layer);
		displayMarkers(xmlArray,markers,layer,smlIcon); //return markers inside drawn shape
	});	
};


















