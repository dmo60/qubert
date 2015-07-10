var url = "http://127.0.0.1:8080";

$(document).ready(function () {
    var map;
    var video = $("#video")[0];
    var canvas = $("#canvas")[0];

    var videos = [];
    var selectedVideo = null;
    var intersectionVideos = [];

    var videoPlayer = 0;

    google.maps.event.addDomListener(window, 'load', initialize);

    function initialize() {
        var mapOptions = {
            center: {lat: 48.1510642, lng: 11.5925221},
            zoom: 19,
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            heading: 10,
            tilt: 45,
            styles: [
                {
                    "featureType": "landscape.natural",
                    "elementType": "geometry.fill",
                    "stylers": [
                        {
                            "visibility": "on"
                        },
                        {
                            "color": "#e0efef"
                        }
                    ]
                },
                {
                    "featureType": "poi",
                    "elementType": "geometry.fill",
                    "stylers": [
                        {
                            "visibility": "on"
                        },
                        {
                            "color": "#45b29d"
                        }
                    ]
                },
                {
                    "featureType": "road",
                    "elementType": "geometry",
                    "stylers": [
                        {
                            "lightness": 100
                        },
                        {
                            "visibility": "simplified"
                        }
                    ]
                },
                {
                    "featureType": "road",
                    "elementType": "labels",
                    "stylers": [
                        {
                            "visibility": "off"
                        }
                    ]
                },
                {
                    "featureType": "transit.line",
                    "elementType": "geometry",
                    "stylers": [
                        {
                            "visibility": "on"
                        },
                        {
                            "lightness": 700
                        }
                    ]
                },
                {
                    "featureType": "water",
                    "elementType": "all",
                    "stylers": [
                        {
                            "color": "#7dcdcd"
                        }
                    ]
                },
                {
                    "featureType": "water",
                    "elementType": "geometry.fill",
                    "stylers": [
                        {
                            "color": "#334d5c"
                        }
                    ]
                },
                {
                    "featureType": "water",
                    "elementType": "labels.text.fill",
                    "stylers": [
                        {
                            "color": "#ffffff"
                        }
                    ]
                },
                {
                    "featureType": "water",
                    "elementType": "labels.text.stroke",
                    "stylers": [
                        {
                            "color": "#334d5c"
                        }
                    ]
                }
            ]
        };
        map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
        google.maps.event.addListener(map, "idle", requestVideos);
        google.maps.event.addListener(map, "click", onMapClicked);
    }

    function rotateHeading(deg) {
        //Only possible at enough Zoom and Tilt 45 and map.Satellite
        var heading = map.getHeading();
        console.log(heading);
        map.setHeading(heading + deg);

    }

    function requestVideos() {
        $.get(getURLfromBounds(), function (data) {
            $.each(data, function () {
                //TODO: delete markers out of bounds

                if (getVideoForId(this.id)) {
                    return true;
                }

                var video = new Video(this.id, this.lat, this.lng);
                if (selectedVideo == null) {
                    video.drawMarker(map);
                }
                video.onMarkerClick(videoMarkerClicked);
                videos.push(video);
            });
        });
    }

    function videoMarkerClicked(video) {
        selectedVideo = video;
        video.drawPath(map);
        video.drawPositionMarker(map);

        getIntersectionVideos(selectedVideo.id);
        hideUnselectedVideos();

        updateCenter(video.position);
        showVideo(selectedVideo.id);
    }

    function onMapClicked() {
        if (selectedVideo != null) {
            video.pause();
            selectedVideo.removePath();
            selectedVideo.removePositionMarker();

            intersectionVideos.forEach(function (video) {
                video.removeIntersectionRoute();
            });

            selectedVideo = null;
            intersectionVideos = [];
            showAllVideos();
        }
    }

    function hideUnselectedVideos() {
        videos.forEach(function (video) {
            if (video.id != selectedVideo.id) {
                video.removeMarker();
            }
        });
    }

    function updateCenter(pos) {
        map.panTo(pos);
    }

    function showAllVideos() {
        videos.forEach(function (video) {
            video.drawMarker(map);
        })
    }

    function getIntersectionVideos(id) {
        $.get(getURLforIntersections(id), function (data) {
            for (var i = 0; i < data.videos.length; i++) {

                var curr = data.videos[i];

                var video = getVideoForId(curr.VideoId);
                if (!video) {
                    video = new Video(curr.VideoId, curr.location.coordinates[1],
                        curr.location.coordinates[0]);
                    video.onMarkerClick(videoMarkerClicked);
                    videos.push(video);
                }

                video.setTrajecotry(curr.trajectory.coordinates);

                var intersectionPoint = data.points[i][data.points[i].length - 1].coordinates;
                video.drawIntersectionRoute({lat: intersectionPoint[0], lng: intersectionPoint[1]}, map);
                intersectionVideos.push(video);
            }
        });
    }

    function getVideoForId(id) {
        for (var i = 0; i < videos.length; i++) {
            if (videos[i].id == id) {
                return videos[i];
            }
        }
        return undefined;
    }

    function getURLfromBounds() {
        var bounds = map.getBounds();
        return url + "/videos?leftTop=" + bounds.getNorthEast().lat() + "," + bounds.getNorthEast().lng() +
            "&rightBottom=" + bounds.getSouthWest().lat() + "," + bounds.getSouthWest().lng();
    }

    function showVideo(id) {
        //$(video).removeAttribute("controls");

        var oldvideoID = "#video" + videoPlayer;
        var oldVideo = document.getElementById("video" + videoPlayer);
        videoPlayer = (videoPlayer == 0) ? 1 : 0;
        var newVideoID = "#video" + videoPlayer;
        var newVideo = document.getElementById("video" + videoPlayer);
        video = $(newVideoID)[0];

        newVideo.src = getVideoUrl(id);
        newVideo.addEventListener("loadeddata", function () {
            $(oldvideoID).animate({
                opacity: 0
            }, 500, function () {
                oldVideo.pause();
            });
            $(oldvideoID).off("play");


            $(newVideoID).animate({
                opacity: 1
            }, 500);


            $(newVideoID).on("play", function () {
                $(canvas).width($(video).width());
                $(canvas).height($(video).height());


                onVideoProgress();
            });

        });
    }

    function onVideoProgress() {
        if (video.paused || video.ended) {
            return;
        }
        selectedVideo.updatePositionMarker(Math.round(video.currentTime));
        setTimeout(onVideoProgress, 1000);
    }

    function getVideoUrl(id) {
        return "http://mediaq.dbs.ifi.lmu.de/MediaQ_MVC_V2/video_content/" + id;
    }

    function getURLforIntersections(id) {
        return url + "/intersections?videoID=" + id;
    }

});


var Video = function (id, lat, lng) {

    var self = this;
    this.id = id;
    this.position = new google.maps.LatLng(lat, lng);
    this.marker = null;
    this.trajectory = null;
    this.polyline = null;
    this.positionMarker = null;
    this.intersectionRoute = null;
    this.intersectionMarker = null;

    this.drawMarker = function (map) {
        if (self.marker != null) {
            self.marker.setMap(map);
            return;
        }

        self.marker = new google.maps.Marker({
            icon: 'img/icon_video.png',
            position: self.position,
            map: map
        });
    };

    this.removeMarker = function () {
        if (self.marker != null) {
            self.marker.setMap(null);
        }
    };

    this.onMarkerClick = function (callback) {
        if (self.marker == null) {
            self.drawMarker(null);
        }
        google.maps.event.addListener(self.marker, 'click', function () {
            callback(self);
        });
    };

    this.setTrajecotry = function (trajectory) {
        self.trajectory = trajectory;
    };

    this.drawPath = function (map) {
        if (self.trajectory == null) {
            loadTrajectory(self.drawPath, map);
            return;
        }

        var waypoints = [];
        self.trajectory.forEach(function (p) {
            waypoints.push(new google.maps.LatLng(p[1], p[0]))
        });

        var lineSymbol = {
            path: 'M -1,0 0,-2 1,0',
            strokeOpacity: 1,
            scale: 3
        };

        self.polyline = new google.maps.Polyline({
            path: waypoints,
            strokeColor: "blue",
            strokeOpacity: 1.0,
            strokeWeight: 3,
            icons: [{
                icon: lineSymbol,
                offset: '0',
                repeat: '10px'
            }],
            map: map
        });
    };

    this.removePath = function () {
        if (self.polyline != null) {
            self.polyline.setMap(null);
            self.polyline = null;
        }
    };

    function loadTrajectory(callback, args) {
        var pathUrl = url + "/videopath?videoID=" + self.id;

        $.get(pathUrl, function (data) {
            self.trajectory = data;
            if (callback != "undefined") {
                callback(args);
            }
        });
    }

    this.drawPositionMarker = function (map) {
        var image = {
            url: "img/position.png",
            size: new google.maps.Size(25, 25),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(12.5, 12.5)
        };

        self.positionMarker = new google.maps.Marker({
            icon: image,
            position: self.position,
            map: map
        });
    };

    this.updatePositionMarker = function (seconds) {
        if (self.positionMarker == null) {
            console.error("Cannot update position marker: is null!");
            return;
        }
        var point = getPointForSecond(seconds);
        var newPosition = new google.maps.LatLng(point[1], point[0]);
        self.positionMarker.setPosition(newPosition);
    };

    this.removePositionMarker = function () {
        if (self.positionMarker != null) {
            self.positionMarker.setMap(null);
            self.positionMarker = null;
        }
    };

    function getPointForSecond(second) {
        for (var i = 0; i < self.trajectory.length; i++) {
            var point = self.trajectory[i];
            if (point[2] == second + 1) {
                return point;
            }
        }

        return self.trajectory[self.trajectory.length - 1];
    }

    this.drawIntersectionRoute = function (intersectionPoint, map) {
        var routePoints = [];
        var isAfterIntersection = false;
        var latlng = new google.maps.LatLng(intersectionPoint.lat, intersectionPoint.lng);

        for (var j = 0; j < self.trajectory.length; j++) {

            var a = self.trajectory[j];
            if (!isAfterIntersection) {
                if (j == self.trajectory.length - 1)
                    continue;

                var b = self.trajectory[j + 1];
                var latLng1 = new google.maps.LatLng(a[1], a[0]);
                var latLng2 = new google.maps.LatLng(b[1], b[0]);

                var polyline = new google.maps.Polyline({
                    path: [latLng1, latLng2]
                });
                if (!google.maps.geometry.poly.containsLocation(latlng, polyline))
                    continue;

                isAfterIntersection = true;
            }
            routePoints.push(new google.maps.LatLng(a[1], a[0]));
        }

        routePoints[0] = latlng;

        self.intersectionMarker = new google.maps.Marker({
            icon: 'img/icon_intersection.png',
            position: latlng,
            map: map
        });

        self.intersectionRoute = new google.maps.Polyline({
            path: routePoints,
            strokeWeight: 3,
            strokeColor: "gray",
            map: map
        });
    };

    this.removeIntersectionRoute = function () {
        if (self.intersectionRoute != null) {
            self.intersectionRoute.setMap(null);
            self.intersectionRoute = null;
            self.intersectionMarker.setMap(null);
            self.intersectionMarker = null;
        }
    }

};
