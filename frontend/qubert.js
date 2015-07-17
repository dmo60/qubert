var url = "http://127.0.0.1:8080";
var style = styles.QUBERT;

var isPacMan = false;
var myAudio;

// the index of the current video in the path
var currentIndex = 0;


//global position marker
var globalVideoCursor;

$(document).ready(function () {
    myAudio = $("#audio1").get(0);
    //the current google map
    var map;
    //the html 5 video
    var video = $("#video")[0];

    //list of all videos loaded from the server
    var videos = [];
    //the currently shown video object (not the actual video, see above)
    var currentVideo = null;

    //a list of video objects which form the path the user is currently in
    var videoPath = [];

    //variable for checking which videoplayer you're in
    //there are two for smooth siwtching between videos
    var videoPlayer = 0;

    var isPlaying;
    var minDistance = 0;

    var previousDistance = 0;
    var currentDistance = 0;

    var spinner;


    google.maps.event.addDomListener(window, 'load', initialize);

    $("#stylesheet").attr("href", style.styleSheet);
    $("#pacman").click(function () {
        if (!isPacMan) {
            setStyle(styles.PACMAN);
            isPacMan = true;
            myAudio.play();
        } else {
            setStyle(styles.QUBERT);
            isPacMan = false;
            myAudio.stop();
        }
    });

    spinner = $("#spinner").spinner({min: 0});
    minDistance = spinner[0].value;

    $("#updateDb").click(function() {
        $.get(url + "/mongo/init", function(data) {
            alert(data);
        })
    });

    setPlaying(false);

    function initialize() {
        var mapOptions = {
            center: {lat: 48.1510642, lng: 11.5925221},
            zoom: 17,
            heading: 10,
            tilt: 45,
            styles: style.map
        };
        map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
        google.maps.event.addListener(map, "idle", requestVideos);
        google.maps.event.addListener(map, "click", onMapClicked);

        spinner.on("spin", function (event, ui) {
            filterVideos();
        });

        $("#setMinDist").click(function () {
            filterVideos();
        })
    }

    function setGlobalVideoCursor(latLng) {
        if (isPacMan) {
            var image = {
                icon: style.positionIcon,
                optimized: false,
                size: new google.maps.Size(25, 25),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(12.5, 12.5)
            };
        } else {
            var image = {
                icon: style.positionIcon,
                optimized: false,
                size: new google.maps.Size(25, 25)
            };
        }
        if(globalVideoCursor!=null) {
            globalVideoCursor.position=latLng;
        } else
        globalVideoCursor = new google.maps.Marker({
            icon: image,
            optimized: false,
            draggable: false,
            icon: style.positionIcon,
            position: latLng,
            map: map
        });
    }

    function updateGlobalVideoCursor() {

        if (globalVideoCursor == null) {
            console.error("Cannot update position marker: is null!");
            return;
        }

        if (currentVideo.trajectory == null) {
            globalVideoCursor.setPosition(currentVideo.position);
            return;
        }

        //var point = getPointForSecond(seconds);
        //var newPosition = new google.maps.LatLng(point[1], point[0]);
        globalVideoCursor.setPosition(currentVideo.updatePositionMarker(Math.round(video.currentTime)));

    }

    function hideGlobalVideoCursor() {
        if (globalVideoCursor != null) {
            globalVideoCursor.setMap(null);
            globalVideoCursor = null;
        }
    }

    function filterVideos() {
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

    function requestVideos() {
        $.get(getURLfromBounds(), function (data) {
            $.each(data, function () {

                if (getVideoForId(this.id)) {
                    return true;
                }

                var video = new Video(this.id, this.lat, this.lng);
                video.setTrajectory(this.trajectory.coordinates);
                if (currentVideo == null) {
                    video.drawMarker(map);
                }
                video.onMarkerClick(videoMarkerClicked);
                videos.push(video);
            });
        });
    }


    //clicked on a video marker (so that the video starts)
    function videoMarkerClicked(video) {
        console.log("videoMarkerClicked()" + video);

        setPlaying(true);
        currentVideo = video;


        //reset the videopath and push the clicked video onto it
        videoPath = [];
        currentIndex = 0;
        videoPath.push(currentVideo);
        //video.drawPath(map);
        //currentVideo.drawPositionMarker(map);
        setGlobalVideoCursor(currentVideo.position);
        currentVideo.videoPathDepth = 0;

        drawVideoPath();

        getIntersectionVideos(currentVideo);
        hideUnselectedVideos();

        updateCenter(video.position);
        showVideoAtTime(currentVideo.id, 0);
    }

    //clicked on map to reset
    function onMapClicked() {
        resetDistance();
        setPlaying(false);

        if (currentVideo != null) {

            video.pause();

            $("video").attr("src", "")
                .each(function () {
                    this.currentTime = 0;
                });

            videoPath.forEach(function (vid) {
                vid.removePath();
                //vid.removePositionMarker();
                hideGlobalVideoCursor();
                vid.removeSplitPoint();
                vid.removeIntersectionRoute();
                vid.intersectionVideos.forEach(function (video) {
                    video.removeIntersectionRoute();
                    video.removePath();
                });
                vid.intersectionVideos = [];
            });

            currentVideo = null;
            videoPath = [];
            showAllVideos();
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

    //get intersections for vid
    function getIntersectionVideos(vid) {
        var id = vid.id;
        var onIntersectionVideo = vid.intersectionMarker != null;
        var polylineGeoJson = null;

        //if video has previously been a intersection in the path,
        //get current polyline so that you only draw intersections after the split
        if (onIntersectionVideo) {
            polylineGeoJson = {"type": "LineString", "coordinates": []};
            vid.polyline.getPath().forEach(function (latlng) {
                polylineGeoJson.coordinates.push([latlng.lng(), latlng.lat()]);
            });
        }

        $.get(getURLforIntersections(id), function (data) {
            console.log("replies:" + data.videos.length);
            for (var i = 0; i < data.videos.length; i++) {

                var curr = data.videos[i];


                //if video has previously been a intersection in the path,
                //check if the new intersection intersects with the old one so that you only draw intersections after the split
                if (onIntersectionVideo) {
                    console.log("lineintersects: " + lineStringsIntersect(curr.trajectory, polylineGeoJson));
                    if (!lineStringsIntersect(curr.trajectory, polylineGeoJson)) {
                        continue;
                    }
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


                video.setTrajectory(curr.trajectory.coordinates);
                video.intersectionPoint = data.points[i][data.points[i].length - 1].coordinates;

                vid.intersectionVideos.push(video);

            }
            drawVideoPath();
        });
    }

    //removes intersections from videos further back in the path so they can be set as intersections for the new one
    function removeOtherSelectionFromPath() {
        for (var i = 0; i < videoPath.length; i++) {
            if (videoPath[i].videoPathDepth > currentIndex) {
                videoPath[i].removeSplitPoint();
                //videoPath[i].removePositionMarker();
                hideGlobalVideoCursor();
                videoPath[i].removePath();
                videoPath[i].removeIntersectionPolyline();
                videoPath.splice(i, 1);
            }
        }
    }

    function addToVideoPath(video) {
        //check if it's already in the path
        for (var i = 0; i < videoPath.length; i++) {
            if (videoPath[i].id == video.id) {
                return;
            }
        }
        videoPath.push(video);
        video.videoPathDepth = currentIndex + 1;
        console.log("Video added to path. currentIndex:" + currentIndex);
    }

    //iterate through videoPath and draw every video
    function drawVideoPath() {
        for (var i = 0; i < videoPath.length; i++) {
            var curr = videoPath[i];

            curr.drawPath(map);

            //draw intersections if you reach the current video
            if (curr.videoPathDepth == currentIndex) {
                curr.intersectionVideos.forEach(function (video) {

                    video.drawIntersectionRoute({
                        lat: video.intersectionPoint[0],
                        lng: video.intersectionPoint[1]
                    }, map, curr);

                    //itersectionMarker will be set null if the intersection isn't on curr's polyline
                    if (video.intersectionMarker == null) {
                        return;
                    }

                    //set the time at which the current Video reaches this intersection
                    video.intersectionTime = currentVideo.getSecondsforPoint(video.intersectionMarker.position);

                    //add intersection click eventlistener callback
                    video.onIntersectionClick(intersectionClicked);
                });
                //only draw the line after the split for the current video
            } else curr.removeSplitPolyline();

        }

    }

    //check if video is already initialized, returns undefined if not.
    function getVideoForId(id) {
        for (var i = 0; i < videos.length; i++) {
            if (videos[i].id == id) {
                return videos[i];
            }
        }
        return undefined;
    }

    //get url for the bounds of the map
    function getURLfromBounds() {
        var bounds = map.getBounds();
        var ret = url + "/videos?leftTop=" + bounds.getNorthEast().lat() + "," + bounds.getNorthEast().lng() +
            "&rightBottom=" + bounds.getSouthWest().lat() + "," + bounds.getSouthWest().lng() + "&minDistance=" + minDistance;

        console.log(ret);
        return url + "/videos?leftTop=" + bounds.getNorthEast().lat() + "," + bounds.getNorthEast().lng() +
            "&rightBottom=" + bounds.getSouthWest().lat() + "," + bounds.getSouthWest().lng() + "&minDistance=" + minDistance;

    }

    function showVideoAtTime(id, time) {

        console.log("showVideoAtTime()")
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
                onVideoProgress();
            });

        });
    }


    function onVideoProgress() {
        if (video.paused || video.ended) {
            return;
        }
        //currentVideo.updatePositionMarker(Math.round(video.currentTime));
        updateGlobalVideoCursor();
        //if the video is split, check if the current time is after the split
        //if yes, jump to the next video;
        if (currentVideo.splitTime != null && Math.round(video.currentTime) > currentVideo.splitTime) {
            getNextVideo();
            return;
        }
        getCurrentDistance(map);
        setTimeout(onVideoProgress, 1000);
    }

    //an intersection/an intersection marker was clicked
    function intersectionClicked(vid) {
        //only allow click after where the video currently is at
        if (video.currentTime > vid.intersectionTime)
            return;

        //set the split point for splitting the current Video
        var deselect = (currentVideo.splitPoint == vid.intersectionMarker.getPosition());
        if (!deselect) {
            currentVideo.splitPoint = vid.intersectionMarker.getPosition();
            currentVideo.splitTime = currentVideo.getSecondsforPoint(currentVideo.splitPoint);
        } else {
            currentVideo.splitPoint = null;
            currentVideo.splitTime = null;

            console.log("deselect");
        }


        //remove other selected Intersections
        removeOtherSelectionFromPath();

        //add the intersection to the path
        if (!deselect) {
            addToVideoPath(vid);
        } else {
            setGlobalVideoCursor(currentVideo.position);
        }


        //draw the new path.
        drawVideoPath();
    }

    //check if video is already in videoPath
    function isInVideoPath(video) {
        for (var i = 0; i < videoPath.length; i++) {
            var curr = videoPath[i];
            if (curr.id == video.id) {
                return true;
            }

        }
        return false;
    }

    //load next Video if the split is reached
    function getNextVideo() {

        video.pause();

        addDistanceToPrevious();

        //remove the line after the split
        currentVideo.removeSplitPolyline();

        //replace currentVideo with new one, up the current index in the path
        currentIndex++;
        //videoPath[currentIndex].positionMarker = currentVideo.positionMarker;
        currentVideo = videoPath[currentIndex];

        //show the video at the time where the intersection is
        var time = currentVideo.getSecondsforPoint(currentVideo.intersectionMarker.position);
        showVideoAtTime(currentVideo.id, time);

        //remove the intersections from the old path
        removeOldIntersections();

        //get the intersections for the new video in the path
        getIntersectionVideos(currentVideo);

        //redraw the path
        drawVideoPath();
    }

    //removes intersections from all videos before the current one in the path
    //in case they were left ofer (they were)
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

    function setStyle(newStyle) {
        style = newStyle;
        $("#stylesheet").attr("href", style.styleSheet);
        $("#logo").attr("src", style.logo);
        map.setOptions({styles: style.map});
        videos.forEach(function (vid) {
            vid.marker.setIcon(style.videoIcon);
        });
    }

    function setPlaying(playing) {
        if (playing == isPlaying) {
            return;
        }

        isPlaying = playing;
        if (isPlaying) {
            $("#contentIdle").hide();

            $("#contentPlaying").show();
            $("#score").show();


        } else {

            $("#contentPlaying").hide();
            $("#score").hide();

            $("#contentIdle").show();
        }
    }

    function getCurrentDistance(map) {
        var polyline = currentVideo.getPolylineUptoPositionMarker(map);
        if (polyline != null) {
            currentDistance = polyline.Distance();
            updateDistanceOnGUI();
        }
    }

    function resetDistance() {
        currentDistance = 0;
        previousDistance = 0;
        updateDistanceOnGUI();
    }

    function updateDistanceOnGUI() {
        var amount = Math.round(previousDistance + currentDistance);
        if (isPacMan)
            $("#score").text("You ate " + amount + " points");
        else
            $("#score").text("You walked " + amount + "m");
    }

    function resetCurrentDistance() {
        currentDistance = 0;
        updateDistanceOnGUI();
    }

    function addDistanceToPrevious() {
        previousDistance += currentDistance;
        resetCurrentDistance();
        updateDistanceOnGUI();
    }

});


var Video = function (id, lat, lng) {

    var self = this;
    this.id = id;
    //the position of the video in the map
    this.position = new google.maps.LatLng(lat, lng);
    this.marker = null;
    //the trajectory from the database
    this.trajectory = null;
    //the main polyline from the path
    this.polyline = null;
    this.positionMarker = null;

    //the polyline if the video is an intersection
    this.intersectionPolyline = null;
    //the marker where the intersection starts
    this.intersectionMarker = null;
    //the time where the intersection is at the currentVideo
    this.intersectionTime = null;

    //where the video is cut off so that it can go into an intersection
    this.splitPoint = null;
    //the polyline after the split
    this.splitPolyline = null;
    //the time at which the video is split
    this.splitTime = null;

    //the line behind the positionmarker, pacman has eaten it already.
    this.pacManEatenPolyline = null;

    //the list of the video's intersection
    this.intersectionVideos = [];

    //the depth/index of the video in the videoPath
    var videoPathDepth = 0;

    this.drawMarker = function (map) {
        if (self.marker != null) {
            self.marker.setMap(map);
            return;
        }

        self.marker = new google.maps.Marker({
            icon: style.videoIcon,
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
        this.splitTime = null;
        self.splitPoint = null;
        if (this.splitPolyline != null) {
            this.splitPolyline.setMap(null);
            this.splitPolyline = null;
        }
    };

    //hand callback to the marker's eventListener
    this.onMarkerClick = function (callback) {
        if (self.marker == null) {
            self.drawMarker(null);
        }
        google.maps.event.addListener(self.marker, 'click', function () {
            callback(self);
        });
    };

    this.setTrajectory = function (trajectory) {
        self.trajectory = trajectory;
    };
    /*
     //old drawpath implementation
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
        // if there is no trajectory yet, request one from the server
        if (self.trajectory == null) {
            loadTrajectory(self.drawPath, map);
            return;
        }

        //remove old Paths
        self.removePath();
        self.removeIntersectionPolyline();

        //list of points for building the polyine
        var waypoints = [];
        //list of points for building the polyline after the split
        var splitpoints = [];
        var isbeforeSplit = true;

        //check if the video has previously been another video's intersection in the videoPath
        var afterIntersection = true;
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

                //if the video has been an intersection and you haven't reached the intersectionpoint yet, continue
                if (!afterIntersection && !google.maps.geometry.poly.containsLocation(self.intersectionMarker.position, polyline))
                    continue;
                else if (!afterIntersection) {

                    //it has reached the intersection point to continue
                    afterIntersection = true;
                    waypoints.push(self.intersectionMarker.position);
                    continue;
                }


                //if the video is split, check if the splitpoint is reached
                //if yes, split the video here
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

        if (isPacMan && self.videoPathDepth < currentIndex)
            self.polyline = new google.maps.Polyline(style.pacManEatenPolyline(map, waypoints));
        else
            self.polyline = new google.maps.Polyline(style.pathPolyline(map, waypoints));
        if (self.splitPoint != null) {
            self.splitPolyline = new google.maps.Polyline(style.splitPolyline(map, splitpoints));
        }
    };


    //remove the path components
    this.removePath = function () {
        self.removePolyline();
        if (self.splitPolyline != null) {
            self.splitPolyline.setMap(null);
            self.splitPolyline = null;
        }
    };

    //load Trajectories from the backend
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
        /*     var image = {
         url: "img/player.gif",
         optimized: false,
         size: new google.maps.Size(45, 45),
         origin: new google.maps.Point(0, 0),
         anchor: new google.maps.Point(22.5, 22.5)
         };*/

        /*self.positionMarker = new google.maps.Marker({

         optimized: false,
         draggable: false,
         icon: style.positionIcon,
         position: self.position,
         map: map
         });*/
        //setGlobalVideoCursor(self.position);
    };

    //check if video is at splitpoint at seconds
    this.isAtSplitPoint = function (seconds) {
        if (self.splitPoint == null || self.splitPoint == undefined)
            return false;
        var point = getPointForSecond(seconds);
        var nextpoint = getPointForSecond((seconds + 1));
        var latLng1 = new google.maps.LatLng(point[1], point[0]);
        var latLng2 = new google.maps.LatLng(nextpoint[0], nextpoint[1]);
        var polyline = new google.maps.Polyline({
            path: [latLng1, latLng2]
        });
        return google.maps.geometry.poly.containsLocation(self.splitPoint, polyline);
    };

    this.updatePositionMarker = function (seconds) {
        //if (self.positionMarker == null) {
        //    console.error("Cannot update position marker: is null!");
        //    return;
        //}

        var point = getPointForSecond(seconds);
        var newPosition = new google.maps.LatLng(point[1], point[0]);
        //updateGlobalVideoCursor(newPosition);
        return newPosition;
    };


    this.removePositionMarker = function () {
        //if (self.positionMarker != null) {
        //    self.positionMarker.setMap(null);
        //    self.positionMarker = null;
        //}
        //hideGlobalVideoCursor();
    };

    //get where the video trajectory is at for the current time
    function getPointForSecond(second) {
        for (var i = 0; i < self.trajectory.length; i++) {
            var point = self.trajectory[i];
            if (point[2] == second + 1) {
                return point;
            }
        }

        return self.trajectory[self.trajectory.length - 1];
    };

    //get where the video time is for a certain point
    this.getSecondsforPoint = function (latLng) {

        var i = 0;
        var found = false;
        for (; !found && i < self.trajectory.length - 1; i++) {
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
        return self.trajectory[i][2] - 1;
    };

    //draw the intersection
    this.drawIntersectionRoute = function (intersectionPoint, map, parentVideo) {
        //return if already drawn
        if (self.intersectionPolyline != null)
            return;
        //points for bulding the polyline
        var routePoints = [];
        //bool for checking if the polyline is after the intersection marker
        var isAfterIntersection = false;
        var latlng = new google.maps.LatLng(intersectionPoint.lat, intersectionPoint.lng);
        //if marker exists, clear it fist
        //is the case if video was another video's intersection I think
        if (self.intersectionMarker != null) {
            self.intersectionMarker.setMap(null);
            self.intersectionMarker = null;
        }
        var markerimage = {
            url: style.intersectionIcon,
            size: new google.maps.Size(22, 22),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(11, 11)
        };
        self.intersectionMarker = new google.maps.Marker({
            icon: markerimage,
            position: latlng
        });

        //if the intersectionmarker isn't on the current video's polyline, don't continue
        if (!google.maps.geometry.poly.containsLocation(latlng, parentVideo.polyline)) {
            self.intersectionMarker = null;
            return;
        }

        self.intersectionMarker.setMap(map);

        for (var j = 0; j < self.trajectory.length; j++) {

            var a = self.trajectory[j];
            //if you haven't reached the intersecton point yet, check
            if (!isAfterIntersection) {
                if (j == self.trajectory.length - 1)
                    continue;

                var b = self.trajectory[j + 1];
                var latLng1 = new google.maps.LatLng(a[1], a[0]);
                var latLng2 = new google.maps.LatLng(b[1], b[0]);

                var polyline = new google.maps.Polyline({
                    path: [latLng1, latLng2]
                });
                //check if current part of the trajectory intersects with the intersection point
                if (!google.maps.geometry.poly.containsLocation(latlng, polyline))
                    continue;
                //if it does, finally start pushing points
                isAfterIntersection = true;
            }
            routePoints.push(new google.maps.LatLng(a[1], a[0]));
        }
        //first point of the polyline always is the intersection point so it starts nicely at the marker
        routePoints[0] = latlng;

        self.intersectionPolyline = new google.maps.Polyline(style.intersectionPolyline(map, routePoints));
    };

    //give intersection marker & intersection polyline the callback when they are clicked
    this.onIntersectionClick = function (callback) {
        google.maps.event.clearListeners(self.intersectionMarker, "click");
        google.maps.event.addListener(self.intersectionMarker, "click", function () {
            callback(self);
        });
        google.maps.event.clearListeners(self.intersectionPolyline, "click");
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
        self.intersectionTime = null;
        if (self.intersectionPolyline != null) {
            self.intersectionPolyline.setMap(null);
            self.intersectionPolyline = null;
        }
        if (self.intersectionMarker != null) {
            self.intersectionMarker.setMap(null);
            self.intersectionMarker = null;
        }
    };

    this.getPolylineUptoPositionMarker = function (map) {
        var path = [];
        var afterpath = null;
        if (isPacMan) {
            self.drawPath();
            afterpath = [];
        }

        if (self.polyline == null)
            return null;

        var isafter = false;
        var polylinePath = self.polyline.getPath().getArray();
        for (var i = 0; i < polylinePath.length; i++) {
            var latLng1 = new google.maps.LatLng(polylinePath[i].lat(), polylinePath[i].lng());
            if (!isafter)
                path.push(latLng1);
            else
                afterpath.push(latLng1);
            if (!isafter && i < polylinePath.length - 1) {
                var latLng2 = new google.maps.LatLng(polylinePath[i + 1].lat(), polylinePath[i + 1].lng());

                var polyline = new google.maps.Polyline({
                    path: [latLng1, latLng2]
                });

                //if the video has been an intersection and you haven't reached the intersectionpoint yet, continue
                if (google.maps.geometry.poly.containsLocation(globalVideoCursor.position, polyline)) {
                    path.push(globalVideoCursor.position);
                    isafter = true;
                    if (!isPacMan)
                        break;
                    afterpath.push(globalVideoCursor.position);
                }
            }
        }
        if (isPacMan) {
            self.removePolyline();
            self.polyline = new google.maps.Polyline(style.pathPolyline(map, afterpath));
            self.pacManEatenPolyline = new google.maps.Polyline(style.pacManEatenPolyline(map, path));
            return self.pacManEatenPolyline;
        }


        return new google.maps.Polyline({
            path: path
        });
    };

    this.removePolyline = function () {
        if (self.polyline != null) {
            self.polyline.setMap(null);
            self.polyline = null;
        }
        if (self.pacManEatenPolyline != null) {
            self.pacManEatenPolyline.setMap(null);
            self.pacManEatenPolyline = null;
        }
    };

};
