var styles = {

    DEFAULT: {
        styleSheet: "css/default.css",
        videoIcon: "img/icon_video.png",
        intersectionIcon: "img/icon_intersection.png",
        logo: "img/logo.png",
        positionIcon: "img/position.png",
        pathPolyline: function (map, waypoints) {
            return {
                path: waypoints,
                strokeColor: "blue",
                strokeOpacity: 1.0,
                strokeWeight: 3,
                map: map
            }
        },
        splitPolyline: function (map, waypoints) {
            return {
                path: waypoints,
                strokeColor: "#FFFFFF",
                strokeOpacity: 0.5,
                strokeWeight: 3,
                map: map
            }
        },
        intersectionPolyline: function (map, waypoints) {
            return {
                path: waypoints,
                strokeWeight: 3,
                strokeColor: "#FFFFFF",
                strokeOpacity: 0.5,
                map: map
            }
        },
        pacManEatenPolyline: function (map, waypoints) {
            return {
                path: waypoints,
                strokeWeight: 3,
                strokeColor: "#FFFFFF",
                strokeOpacity: 0.2,
                map: map
            }
        },
        map: []
    },

    QUBERT: {
        styleSheet: "css/qubert.css",
        videoIcon: "img/icon_video.png",
        intersectionIcon: "img/icon_intersection.png",
        logo: "img/logo.png",
        positionIcon: "img/position.png",
        pathPolyline: function (map, waypoints) {
            return {
                path: waypoints,
                strokeColor: "#DF4949",
                strokeOpacity: 1.0,
                strokeWeight: 3,
                map: map
            }
        },
        splitPolyline: function (map, waypoints) {
            return {
                path: waypoints,
                strokeColor: "#FFFFFF",
                strokeOpacity: 0.5,
                strokeWeight: 3,
                map: map
            }
        },
        intersectionPolyline: function (map, waypoints) {
            return {
                path: waypoints,
                strokeWeight: 3,
                strokeColor: "#FFFFFF",
                strokeOpacity: 0.5,
                map: map
            }
        },
        pacManEatenPolyline: function (map, waypoints) {
            return {
                path: waypoints,
                strokeWeight: 3,
                strokeColor: "#FFFFFF",
                strokeOpacity: 0.2,
                map: map
            }
        },
        map: [
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
    },

    PACMAN: {
        styleSheet: "css/pacman.css",
        videoIcon: "img/icon_video_pacman.png",
        intersectionIcon: "img/icon_intersection.png",
        logo: "img/logo_pacman.png",
        positionIcon: "img/player.gif",
        pathPolyline: function (map, waypoints) {
            return {
                path: waypoints,
                strokeColor: "#FFFFFF",
                strokeOpacity: 0,
                strokeWeight: 5,
                icons: [{
                    icon: {
                        path: 'M 0,0 0,0.01',
                        strokeOpacity: 1,
                        scale: 5
                    },
                    offset: '0',
                    repeat: '8px'
                }],
                map: map
            }
        },
        splitPolyline: function (map, waypoints) {
            return {
                path: waypoints,
                strokeColor: "#FFFFFF",
                strokeOpacity: 0.5,
                strokeWeight: 3,
                map: map
            }
        },
        intersectionPolyline: function (map, waypoints) {
            return {
                path: waypoints,
                strokeWeight: 3,
                strokeColor: "#FFFFFF",
                strokeOpacity: 0.5,
                map: map
            }
        },
        pacManEatenPolyline: function (map, waypoints) {
            return {
                path: waypoints,
                strokeWeight: 3,
                strokeColor: "#FFFFFF",
                strokeOpacity: 0.2,
                map: map
            }
        },
        map: [
            {
                "featureType": "all",
                "elementType": "labels.text.fill",
                "stylers": [
                    {
                        "saturation": 36
                    },
                    {
                        "color": "#000000"
                    },
                    {
                        "lightness": 40
                    }
                ]
            },
            {
                "featureType": "all",
                "elementType": "labels.text.stroke",
                "stylers": [
                    {
                        "visibility": "on"
                    },
                    {
                        "color": "#000000"
                    },
                    {
                        "lightness": 16
                    }
                ]
            },
            {
                "featureType": "all",
                "elementType": "labels.icon",
                "stylers": [
                    {
                        "visibility": "off"
                    }
                ]
            },
            {
                "featureType": "administrative",
                "elementType": "geometry",
                "stylers": [
                    {
                        "hue": "#ff0000"
                    }
                ]
            },
            {
                "featureType": "administrative",
                "elementType": "geometry.fill",
                "stylers": [
                    {
                        "color": "#000000"
                    },
                    {
                        "lightness": 20
                    }
                ]
            },
            {
                "featureType": "administrative",
                "elementType": "geometry.stroke",
                "stylers": [
                    {
                        "color": "#000000"
                    },
                    {
                        "lightness": 17
                    },
                    {
                        "weight": 1.2
                    }
                ]
            },
            {
                "featureType": "landscape",
                "elementType": "geometry",
                "stylers": [
                    {
                        "color": "#000000"
                    },
                    {
                        "lightness": 20
                    }
                ]
            },
            {
                "featureType": "poi",
                "elementType": "geometry",
                "stylers": [
                    {
                        "color": "#000000"
                    },
                    {
                        "lightness": 21
                    }
                ]
            },
            {
                "featureType": "road.highway",
                "elementType": "geometry",
                "stylers": [
                    {
                        "color": "#0017ff"
                    }
                ]
            },
            {
                "featureType": "road.highway",
                "elementType": "geometry.fill",
                "stylers": [
                    {
                        "color": "#021859"
                    },
                    {
                        "lightness": 17
                    }
                ]
            },
            {
                "featureType": "road.highway",
                "elementType": "geometry.stroke",
                "stylers": [
                    {
                        "color": "#000000"
                    },
                    {
                        "lightness": 29
                    },
                    {
                        "weight": 0.2
                    }
                ]
            },
            {
                "featureType": "road.arterial",
                "elementType": "geometry",
                "stylers": [
                    {
                        "color": "#414af2"
                    },
                    {
                        "lightness": 18
                    }
                ]
            },
            {
                "featureType": "road.local",
                "elementType": "geometry",
                "stylers": [
                    {
                        "color": "#000000"
                    },
                    {
                        "lightness": 16
                    }
                ]
            },
            {
                "featureType": "transit",
                "elementType": "geometry",
                "stylers": [
                    {
                        "color": "#000000"
                    },
                    {
                        "lightness": 19
                    }
                ]
            },
            {
                "featureType": "water",
                "elementType": "geometry",
                "stylers": [
                    {
                        "color": "#021859"
                    },
                    {
                        "lightness": 17
                    }
                ]
            }
        ]
    }

};
