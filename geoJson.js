exports.Point = function(lat, lng) {
    return {
        "type": "Point",
        "coordinates": [lng, lat]
    }
};

exports.LineString = function(coords) {
    return {
        "type": "LineString",
        "coordinates": coords
    }
};

exports.Polygon = function(coords) {
    return {
        "type": "Polygon",
        "coordinates": coords
    }
};
