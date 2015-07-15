// adapted from http://www.kevlindev.com/gui/math/intersection/Intersection.js
lineStringsIntersect = function (l1, l2) {
    var intersects = [];
    for (var i = 0; i <= l1.coordinates.length - 2; ++i) {
        for (var j = 0; j <= l2.coordinates.length - 2; ++j) {
            var a1 = {
                    x: l1.coordinates[i][1],
                    y: l1.coordinates[i][0]
                },
                a2 = {
                    x: l1.coordinates[i + 1][1],
                    y: l1.coordinates[i + 1][0]
                },
                b1 = {
                    x: l2.coordinates[j][1],
                    y: l2.coordinates[j][0]
                },
                b2 = {
                    x: l2.coordinates[j + 1][1],
                    y: l2.coordinates[j + 1][0]
                },
                ua_t = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x),
                ub_t = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x),
                u_b = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);
            if (u_b != 0) {
                var ua = ua_t / u_b,
                    ub = ub_t / u_b;
                if (0 <= ua && ua <= 1 && 0 <= ub && ub <= 1) {
                    intersects.push({
                        'type': 'Point',
                        'coordinates': [a1.x + ua * (a2.x - a1.x), a1.y + ua * (a2.y - a1.y)]
                    });
                }
            }
        }
    }
    if (intersects.length == 0) intersects = false;
    return intersects;
}
