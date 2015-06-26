/**
 * Created by Alexander on 26.06.2015.
 */
$(document).ready(function () {
    var map;
    var url = "http://127.0.0.1:8080";
    var route;
    var markers = [];
    var intersectionRoutes = [];

    var video = $("#video")[0];
    var canvas = $("#canvas")[0];
    var ctx = canvas.getContext("2d");

    function initialize() {
        var mapOptions = {
            center: {lat: 48.1510642, lng: 11.5925221},
            zoom: 15
        };
        map = new google.maps.Map(document.getElementById('map-canvas'),
            mapOptions);
        google.maps.event.addListener(map, "idle", requestVideos);
        //requestVideos();
    }

    google.maps.event.addDomListener(window, 'load', initialize);
    function requestVideos() {
        console.log("Bounds changed. Requesting: " + getURLfromBounds());
        ($).get(getURLfromBounds(), function (data) {
            $.each(data, function () {
                //TODO: delete markers out of bounds
                for (var i = 0; i < markers.length; i++) {
                    if (markers[i].metaData.id == this.id) {
                        return true;
                    }
                }
                var myLatlng = new google.maps.LatLng(this.lat, this.lng);
                var marker = new google.maps.Marker({
                    position: myLatlng,
                    map: map
                });
                marker.metaData = {id: this.id};
                google.maps.event.addListener(marker, 'click', function () {
                    markerClicked(marker);
                });
                markers.push(marker);
            });
            console.log("Markers added." + markers.length);
        });

    }
    function removeIntersectionRoutes(){
        for (var i = 0; i < intersectionRoutes.length; i++) {
            intersectionRoutes[i].setMap(null);
        }
        routes = [];
    }
    function markIntersectionMarker(id) {
        for (var i = 0; i < markers.length; i++) {
            if (markers[i].metaData.id == id) {
                markers[i].setIcon('https://www.google.com/mapfiles/marker_orange.png');
            }
        }
    }

    function removeMarkers() {
        for (var i = 0; i < markers.length; i++) {
            markers[i].setMap(null);
        }
        markers = [];
    }

    function markerClicked(marker){
        var id = marker.metaData.id;
        console.log("Clicked "+id);
        drawPath(id);
        makeOtherMarkersTransparent(marker);
        removeIntersectionRoutes();
        drawIntersectionRoutes(id);
        playVideo(id);
    }

    function makeOtherMarkersTransparent(marker){
        marker.setIcon('https://www.google.com/mapfiles/marker.png');
        for (var i = 0; i < markers.length; i++) {
            if (markers[i]!=marker) {
                markers[i].setIcon('https://www.google.com/mapfiles/marker_yellow.png');
            }
        }
    }

    function drawIntersectionRoutes(id){
        $.get(getURLforIntersections(id), function (data) {
            console.log("Drawing " + data.length +"intersecting paths");
            $.each(data, function () {
                var routePoints = [];
                var coordinates = this.trajectory.coordinates;
                markIntersectionMarker(this.VideoId);
                $.each(coordinates, function (index,coords) {
                    routePoints.push(new google.maps.LatLng(coords[1], coords[0]));
                });
                var route = new google.maps.Polyline({
                    path: routePoints,
                    strokeWeight:1,
                    strokeOpacity: 0.2,
                    map: map
                });
                intersectionRoutes.push(route);
            });
        });
    }

    function drawPath(id) {
        $.get(getURLforPath(id), function (data) {
            var routePoints = [];
            $.each(data, function () {
                routePoints.push(new google.maps.LatLng(this.lat, this.lng));
            });
            if (route != undefined)
                route.setMap(null);
            route = new google.maps.Polyline({
                path: routePoints,
                strokeOpacity: 1.0,
                map: map
            });
        });
    }

    function getURLfromBounds() {
        var bounds = map.getBounds();
        return url + "/videos?leftTop=" + bounds.getNorthEast().lat() + "," + bounds.getNorthEast().lng() +
            "&rightBottom=" + bounds.getSouthWest().lat() + "," + bounds.getSouthWest().lng();
    }

    function getURLforPath(id) {
        return url + "/videopath?videoID=" + id;
    }

    function playVideo(id) {
        $(video).attr("src", getVideoUrl(id));
        $("#overlay").css("z-index", 2);

        $(video).on("play", function () {
            $(canvas).width($(video).width());
            $(canvas).height($(video).height());

            ctx.fillStyle = "red";
            setVideoProgressCallback();
        });
        //video.play();
    }

    function setVideoProgressCallback() {
        if (video.paused || video.ended) {
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillText(video.currentTime.toString(), 10, 10);

        setTimeout(setVideoProgressCallback, 50);

    }

    function getVideoUrl(id) {
        return "http://mediaq.dbs.ifi.lmu.de/MediaQ_MVC_V2/video_content/" + id;
    }

    function getURLforIntersections(id) {
        return url + "/intersections?videoID=" + id;
    }

});