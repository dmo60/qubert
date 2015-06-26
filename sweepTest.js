///**
// * Created by Fabian on 26.06.2015.
// */
//var buckets = require('buckets-js');
//
//
////Initialize priority queue Q
////Initially, Q contains an event for each of the endpoints of the input segments.
////So load in all startPoints of
//
//
//function getIntersectionPoints() {
//    var intersections = [];
//
//
//    var compare = function (a, b) {
//        if (a.lng > b.lng) {
//            return 1;
//        }
//        if (a.lng < b.lng) {
//            return -1;
//        }
//        return 0;
//    };
//
//    var q = buckets.PriorityQueue(compare);
//
//    //Initialise q with events. One event for each endpoint
//    for (var i = 0; i < inputpoints.length; i++) {
//
//        //An event in the priority queue needs
//        var e = {
//            p: {
//                x: inputpoints[i].lat,
//                y: inputpoints[i].lng
//            },
//            //segment of this event
//            segment: [
//                {x:, y:}, {x:, y:}
//            ]
//            ,
//            //polyline the segment belongs to
//            polyline: 0
//        }
//        q.add();
//    }
//
////Initialize a binary search tree T of the line segments that cross the sweep line L,
//// ordered by the y-coordinates of the crossing points. Initially, T is empty.
//    var compare2 = function (a, b) {
//        if (a.lat > b.lat) {
//            return 1;
//        }
//        if (a.lat < b.lat) {
//            return -1;
//        }
//        return 0;
//    };
//    var t = buckets.BSTree(compare2);
//
//
//    while (!q.isEmpty()) {
//        //find and remove the event from Q associated with a point p with minimum x-coordinate
//        var event = buckets.PriorityQueue.dequeue();
//        //Determine what type of event this is and process it according to the following case analysis
//
//        //If p is the left endpoint of a line segment s, insert s into T. Find the segments r and t
//        // that are immediately below and above s in T (if they exist) and if their crossing forms a potential future event in the
//        // event queue, remove it. If s crosses r or t, add those crossing points as potential future events in the event queue.
//        if (event.x < event.segment[1].x) {
//            t.add(event.segment);
//        }
//
//
//        //If p is the right endpoint of a line segment s, remove s from T If p is the right endpoint
//        // of a line segment s, remove s from T. Find the segments r and t that were (prior to the removal of s)
//        // immediately above and below it in T (if they exist).
//        // If r and t cross, add that crossing point as a potential future event in the event queue.
//        if (event.x < event.segment[1].x) {
//            t.add(event.segment);
//        }
//
//
//        //If p is the crossing point of two segments s and t (with s below t to the left of the crossing),
//        // swap the positions of s and t in T. Find the segments r and u (if they exist)
//        // that are immediately below and above t and s respectively (after the swap).
//        // Remove any crossing points rs and tu from the event queue, and, if r and t cross or s and u cross,
//        // add those crossing points to the event queue.
//    }
//
//    return intersections;
//
//}