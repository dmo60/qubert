exports.Point = function(coords) {
    return {
        "type": "Point",
        "coordinates": coords
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
