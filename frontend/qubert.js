var url = "http://127.0.0.1:8080";

$(document).ready(function () {
    var map;
    var video = $("#video")[0];
    var canvas = $("#canvas")[0];

    var videos = [];
    var currentVideo = null;

    var nextVideo = null;
    var currentIndex = 0;
    var videoPath = [];

    var videoPlayer = 0;

    var isPlaying = false;
    var minDistance = 0;

    var spinner;

    google.maps.event.addDomListener(window, 'load', initialize);

    function initialize() {
        var mapOptions = {
            center: {lat: 48.1510642, lng: 11.5925221},
            zoom: 19,
            //mapTypeId: google.maps.MapTypeId.SATELLITE,
            heading: 10,
            tilt: 45,
            styles: mapStyles.DEFAULT
        };
        map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
        google.maps.event.addListener(map, "idle", requestVideos);
        google.maps.event.addListener(map, "click", onMapClicked);


        spinner = $("#spinner").spinner({min: 0});
        $( "#spinner" ).on( "spin", function( event, ui ) {
            filterVideos();

        } );

        $("#setMinDist").click(function () {
            filterVideos();
        })
    }

    function filterVideos(){
        if (!isPlaying) {
            minDistance = spinner.spinner("value");
            console.log(minDistance);
            for (var i = 0; i < videos.length; i++) {
                videos[i].removeMarker();
            }
            videos = [];
            requestVideos();
        }
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
                if (currentVideo == null) {
                    video.drawMarker(map);
                }
                video.onMarkerClick(videoMarkerClicked);
                videos.push(video);
            });
        });
    }

    function videoMarkerClicked(video) {
        isPlaying = true;
        currentVideo = video;
        videoPath = [];
        currentIndex = 0;
        videoPath.push(currentVideo);
        //video.drawPath(map);
        currentVideo.drawPositionMarker(map);
        currentVideo.videoPathDepth = 0;
        drawVideoPath();

        getIntersectionVideos(currentVideo);
        hideUnselectedVideos();

        updateCenter(video.position);
        showVideoAtTime(currentVideo.id, 0);
    }

    function onMapClicked() {
        isPlaying = false;
        videoPath.forEach(function (vid) {
            vid.removePath();
            vid.removePositionMarker();
            vid.removeSplitPoint();
            vid.removeIntersectionRoute();
            vid.intersectionVideos.forEach(function (video) {
                video.removeIntersectionRoute();
                video.removePath();
            });
            vid.intersectionVideos = [];
        });

        if (currentVideo != null) {

            video.pause();
            currentVideo = null;
            videoPath = [];
            showAllVideos();

            //$("#overlay").animate({
            //    width: "0%"
            //}, 250);

        }


    }

    function hideUnselectedVideos() {
        videos.forEach(function (video) {
            if (video.id != currentVideo.id) {
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

    function getIntersectionVideos(vid) {
        var id = vid.id;
        var onIntersectionVideo = vid.intersectionMarker != null;
        var polylineGeoJson = null;

        if (onIntersectionVideo) {
            polylineGeoJson = {"type": "LineString", "coordinates": []};
            vid.polyline.getPath().forEach(function (latlng) {
                polylineGeoJson.coordinates.push([latlng.lng(), latlng.lat()]);
            });
        }

        console.log("id:" + id);
        $.get(getURLforIntersections(id), function (data) {
            console.log("replies:" + data.videos.length);
            for (var i = 0; i < data.videos.length; i++) {

                var curr = data.videos[i];

                if (onIntersectionVideo) {
                    console.log("lineintersects: " + lineStringsIntersect(curr.trajectory, polylineGeoJson));
                    if (!lineStringsIntersect(curr.trajectory, polylineGeoJson))
                        continue;
                }

                var video = getVideoForId(curr.VideoId);
                if (!video) {
                    video = new Video(curr.VideoId, curr.location.coordinates[1],
                        curr.location.coordinates[0]);
                    video.onMarkerClick(videoMarkerClicked);
                    videos.push(video);
                }

                if (isInVideoPath(video))
                    continue;

                video.setTrajecotry(curr.trajectory.coordinates);
                video.intersectionPoint = data.points[i][data.points[i].length - 1].coordinates;
                vid.intersectionVideos.push(video);
            }
            drawVideoPath();
        });
    }


    function removeOtherSelectionFromPath() {
        for (var i = 0; i < videoPath.length; i++) {
            if (videoPath[i].videoPathDepth > currentIndex) {
                videoPath[i].removeSplitPoint();
                videoPath[i].removePositionMarker();
                videoPath[i].removePath();
                videoPath[i].removeIntersectionPolyline();
                videoPath.splice(i, 1);
            }
        }
    }

    function addToVideoPath(video) {
        for (var i = 0; i < videoPath.length; i++) {
            if (videoPath[i].id == video.id) {
                return;
            }
        }
        videoPath.push(video);
        video.videoPathDepth = currentIndex + 1;
        console.log("Video added to path. currentIndex:" + currentIndex);
    }

    function drawVideoPath() {
        for (var i = 0; i < videoPath.length; i++) {
            var curr = videoPath[i];

            curr.drawPath(map);
            if (curr.videoPathDepth == currentIndex) {
                curr.intersectionVideos.forEach(function (video) {

                    video.drawIntersectionRoute({
                        lat: video.intersectionPoint[0],
                        lng: video.intersectionPoint[1]
                    }, map);
                    video.onIntersectionClick(intersectionClicked);
                });
            } else curr.removeSplitPolyline();

        }

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
        var ret = url + "/videos?leftTop=" + bounds.getNorthEast().lat() + "," + bounds.getNorthEast().lng() +
            "&rightBottom=" + bounds.getSouthWest().lat() + "," + bounds.getSouthWest().lng() + "&minDistance=" + minDistance;

        console.log(ret);
        return url + "/videos?leftTop=" + bounds.getNorthEast().lat() + "," + bounds.getNorthEast().lng() +
            "&rightBottom=" + bounds.getSouthWest().lat() + "," + bounds.getSouthWest().lng() + "&minDistance=" + minDistance;

    }


    function showVideoAtTime(id, time) {

        $("#overlay").animate({
            width: "20%"
        }, 250);


        var oldvideoID = "#video" + videoPlayer;
        var oldVideo = document.getElementById("video" + videoPlayer);
        videoPlayer = (videoPlayer == 0) ? 1 : 0;
        var newVideoID = "#video" + videoPlayer;
        var newVideo = document.getElementById("video" + videoPlayer);
        video = $(newVideoID)[0];

        newVideo.src = getVideoUrl(id);
        newVideo.style.display = "block";

        newVideo.addEventListener("loadeddata", function () {

            if (time != undefined) {
                $(newVideoID)[0].currentTime = time;
            }
            $(oldvideoID).animate({
                opacity: 0
            }, 500, function () {
                oldVideo.pause();
                oldVideo.style.display = "none";

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
        currentVideo.updatePositionMarker(Math.round(video.currentTime));
        if (currentVideo.splitTime != null && Math.round(video.currentTime) > currentVideo.splitTime) {
            getNextVideo();
            return;
        }
        setTimeout(onVideoProgress, 1000);
    }

    function intersectionClicked(video) {
        currentVideo.splitPoint = video.intersectionMarker.getPosition();
        currentVideo.splitTime = video.getSecondsforPoint(currentVideo.splitPoint);
        removeOtherSelectionFromPath();
        addToVideoPath(video);
        drawVideoPath();
        console.log("clicked Intersection " + video.id + "currentIndex" + currentIndex);
    }

    function isInVideoPath(video) {
        for (var i = 0; i < videoPath.length; i++) {
            var curr = videoPath[i];
            if (curr.id == video.id) {
                return true;
            }

        }
        return false;
    }

    function getNextVideo() {

        video.pause();
        currentVideo.removeSplitPolyline();
        currentIndex++;
        console.log("currentindex:" + currentIndex + "videoPath:" + videoPath);
        videoPath[currentIndex].positionMarker = currentVideo.positionMarker;
        //currentVideo.removePositionMarker();
        currentVideo = videoPath[currentIndex];
        var time = currentVideo.getSecondsforPoint(currentVideo.intersectionMarker.position);
        console.log("time is:" + time);
        showVideoAtTime(currentVideo.id, time);

        removeOldIntersections();
        getIntersectionVideos(currentVideo);
        drawVideoPath();
    }

    function removeOldIntersections() {

        for (var i = 0; i < videoPath.length; i++) {
            var curr = videoPath[i];
            if (curr.videoPathDepth < currentIndex) {
                curr.intersectionVideos.forEach(function (video) {
                    if (video.id != currentVideo.id)
                        video.removeIntersectionRoute();
                });
                curr.intersectionVideos = [];
            }

        }
    }

    function getVideoUrl(id) {
        return "http://mediaq.dbs.ifi.lmu.de/MediaQ_MVC_V2/video_content/" + id;
    }

    function getURLforIntersections(id) {
        return url + "/intersections?videoID=" + id + "&minDistance=" + minDistance;
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

    this.intersectionPolyline = null;
    this.intersectionMarker = null;
    this.intersectionTime = null;

    this.splitPoint = null;
    this.splitPolyline = null;
    this.splitTime = null;

    this.intersectionVideos = [];

    var videoPathDepth = 0;

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

    this.removeSplitPoint = function () {
        self.splitPoint = null;
        if (this.splitPolyline != null) {
            this.splitPolyline.setMap(null);
            this.splitPolyline = null;
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
    /*
     this.drawPath = function (map) {
     if (self.trajectory == null) {
     loadTrajectory(self.drawPath, map);
     return;
     }

     var waypoints = [];
     self.trajectory.forEach(function (p) {
     waypoints.push(new google.maps.LatLng(p[1], p[0]))
     });
     console.log("waypoints" + waypoints.length);
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
     }; */

    this.drawPath = function (map) {
        if (self.trajectory == null) {
            loadTrajectory(self.drawPath, map);
            return;
        }

        self.removePath();
        self.removeIntersectionPolyline();

        var waypoints = [];
        var splitpoints = [];
        var isbeforeSplit = true;

        var afterIntersection = true
        if (self.intersectionMarker != null)
            afterIntersection = false;

        for (var i = 0; i < self.trajectory.length; i++) {
            var a = self.trajectory[i];

            if (i < self.trajectory.length - 1) {

                var b = self.trajectory[i + 1];
                var latLng1 = new google.maps.LatLng(a[1], a[0]);
                var latLng2 = new google.maps.LatLng(b[1], b[0]);

                var polyline = new google.maps.Polyline({
                    path: [latLng1, latLng2]
                });

                if (!afterIntersection && !google.maps.geometry.poly.containsLocation(self.intersectionMarker.position, polyline))
                    continue;

                afterIntersection = true;

                if (self.splitPoint != null && google.maps.geometry.poly.containsLocation(self.splitPoint, polyline)) {
                    isbeforeSplit = false;
                    waypoints.push(self.splitPoint);
                    splitpoints.push(self.splitPoint);
                }
            }
            if (isbeforeSplit)
                waypoints.push(new google.maps.LatLng(a[1], a[0]));
            else
                splitpoints.push(new google.maps.LatLng(a[1], a[0]));

        }
        var lineSymbol = {
            path: 'M 0,0 0,0.01',
            strokeOpacity: 1,
            scale: 5
        };

        self.polyline = new google.maps.Polyline({
            path: waypoints,
            strokeColor: "#FFFFFF",
            strokeOpacity: 0,
            strokeWeight: 5,
            icons: [{
                icon: lineSymbol,
                offset: '0',
                repeat: '8px'
            }],
            map: map
        });
        if (self.splitPoint != null) {
            self.splitPolyline = new google.maps.Polyline({
                path: splitpoints,
                strokeColor: "#FFFFFF",
                strokeOpacity: 0.5,
                strokeWeight: 3,
                map: map
            });
        }
    };

    this.removePath = function () {
        if (self.polyline != null) {
            self.polyline.setMap(null);
            self.polyline = null;
        }
        if (self.splitPolyline != null) {
            self.splitPolyline.setMap(null);
            self.splitPolyline = null;
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
            url: "img/player.gif",
            optimized:false,
            size: new google.maps.Size(45, 45),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(22.5, 22.5)
        };

        self.positionMarker = new google.maps.Marker({

            optimized:false,
            draggable:false,
            icon: "img/player.gif",
            position: self.position,
            map: map
        });
    };

    this.isAtSplitPoint = function (seconds) {
        if (self.splitPoint == null || self.splitPoint == undefined)
            return false;
        var point = getPointForSecond(seconds);
        var nextpoint = getPointForSecond((seconds + 1));
        var latLng1 = new google.maps.LatLng(point[1], point[0]);
        var latLng2 = new google.maps.LatLng(nextpoint[1], nextpoint[0]);
        var polyline = new google.maps.Polyline({
            path: [latLng1, latLng2]
        });
        return google.maps.geometry.poly.containsLocation(self.splitPoint, polyline);
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

    this.getSecondsforPoint = function (latLng) {

        var i = 0;
        var found = false;
        for (; !found && i < self.trajectory.length; i++) {
            var point = self.trajectory[i];
            var nextpoint = self.trajectory[i + 1];
            var latLng1 = new google.maps.LatLng(point[1], point[0]);
            var latLng2 = new google.maps.LatLng(nextpoint[1], nextpoint[0]);
            var polyline = new google.maps.Polyline({
                path: [latLng1, latLng2]
            });
            if (google.maps.geometry.poly.containsLocation(latLng, polyline))
                found = true;
        }
        return i;
    };

    this.drawIntersectionRoute = function (intersectionPoint, map) {
        if (self.intersectionPolyline != null)
            return;
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

        if (self.intersectionMarker != null) {
            self.intersectionMarker.setMap(null);
            self.intersectionMarker = null;
        }

        var markerimage = {
            url: "img/icon_intersection.png",
            size: new google.maps.Size(22, 22),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(11, 11)
        };



        self.intersectionMarker = new google.maps.Marker({
            icon: markerimage,
            position: latlng,
            map: map
        });

        self.intersectionPolyline = new google.maps.Polyline({
            path: routePoints,
            strokeWeight: 3,
            strokeColor: "#FFFFFF",
            strokeOpacity: 0.5,
            map: map
        });
    };

    this.onIntersectionClick = function (callback) {
        google.maps.event.addListener(self.intersectionMarker, "click", function () {
            callback(self);
        });
        google.maps.event.addListener(self.intersectionPolyline, "click", function () {
            callback(self);
        });
    };

    this.removeIntersectionPolyline = function () {
        if (self.intersectionPolyline != null) {
            self.intersectionPolyline.setMap(null);
            self.intersectionPolyline = null;
        }

    };

    this.removeSplitPolyline = function () {
        if (self.splitPolyline != null) {
            self.splitPolyline.setMap(null);
            self.splitPolyline = null;
        }
    };

    this.removeIntersectionRoute = function () {
        if (self.intersectionPolyline != null) {
            self.intersectionPolyline.setMap(null);
            self.intersectionPolyline = null;
        }
        if (self.intersectionMarker != null) {
            self.intersectionMarker.setMap(null);
            self.intersectionMarker = null;
        }
    }

};
