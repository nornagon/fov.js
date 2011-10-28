/**
 * fov.js: tile-based field of vision calculations
 * Translated from libfov: http://code.google.com/p/libfov/
 *
 * Usage:
 *  var fov_settings = {
 *  	shape: fov.SHAPE_CIRCLE,
 *  	opaque: function (map, x, y) { return isOpaque(map.at(x,y)); },
 *    apply: function (map, x, y, sx, sy) { map.at(x,y).visible = true; },
 *  	opaque_apply: true,
 *  };
 *  fov.circle(fov_settings, map, game.player.x, game.player.y, 30);
 *
 * shape must be in {SHAPE_CIRCLE, SHAPE_OCTAGON}.
 * opaque is a function to determine whether a given tile is opaque or not.
 * apply is a function that will be called on cells calculated to be visible.
 * apply will be called on opaque squares if and only if opaque_apply is true.
 *
 * the arguments to apply are:
 *  - map: the 'map' variable that was passed to fov.circle
 *  - x, y: the co-ordinates of the square that's been calculated as visible
 *  - sx, sy: the co-ordinates of the source of light
 */

fov = (function () {

var FLT_EPSILON = 1e-8;

var FOV_SHAPE_CIRCLE_PRECALCULATE = 0;
var FOV_SHAPE_CIRCLE = 1;
var FOV_SHAPE_OCTAGON = 2;
var FOV_OPAQUE_APPLY = 1;

// TODO: SHAPE_CIRCLE_PRECALCULATE still hasn't been translated over.

function fov_slope(dx, dy) {
	if (dx <= -FLT_EPSILON || dx >= FLT_EPSILON) {
		return dy/dx;
	} else {
		return 0.0;
	}
}

function fov_octant(settings, data, signx, signy, rx, ry, apply_edge, apply_diag, dx, start_slope, end_slope) {
	var p = [0,0], dy, dy0, dy1;
	var h;
	var prev_blocked = -1;
	var end_slope_next;
	
	if (dx == 0) {
		dx = 1;
	} else if (Math.abs(dx) > data.radius) {
		return;
	}

	dy0 = parseInt(0.5 + dx*start_slope);
	dy1 = parseInt(0.5 + dx*end_slope);

	p[rx] = data.source[rx] + signx * dx;
	p[ry] = data.source[ry] + signy * dy0;

	if (!apply_diag && dy1 == dx) {
		--dy1;
	}

	switch (settings.shape) {
		case FOV_SHAPE_CIRCLE_PRECALCULATE:
			h = height(settings, dx, data.radius);
			break;
		case FOV_SHAPE_CIRCLE:
			h = parseInt(Math.sqrt(data.radius*data.radius - dx*dx));
			break;
		case FOV_SHAPE_OCTAGON:
			h = (data.radius - dx) * 2;
			break;
		default:
			h = data.radius;
			break;
	}

	if (Math.abs(dy1) > h) {
		if (h == 0) {
			return;
		}
		dy1 = h;
	}

	for (dy = dy0; dy <= dy1; ++dy) {
		p[ry] = data.source[ry] + signy * dy;
		if (settings.opaque(data.map, p[0], p[1])) {
			if (settings.opaque_apply && (apply_edge || dy > 0)) {
				settings.apply(data.map, p[0], p[1], data.source[0], data.source[1]);
			}
			if (prev_blocked == 0) {
				end_slope_next = fov_slope(dx + 0.5, dy - 0.5);
				fov_octant(settings, data, signx, signy, rx, ry, apply_edge, apply_diag, dx+1, start_slope, end_slope_next);
			}
			prev_blocked = 1;
		} else {
			if (apply_edge || dy > 0) {
				settings.apply(data.map, p[0], p[1],
											 data.source[0], data.source[1],
											 data.source);
			}
			if (prev_blocked == 1) {
				start_slope = fov_slope(dx - 0.5, dy - 0.5);
			}
			prev_blocked = 0;
		}
	}

	if (prev_blocked == 0) {
		fov_octant(settings, data, signx, signy, rx, ry, apply_edge, apply_diag, dx+1, start_slope, end_slope);
	}
}

function _fov_circle(settings, data) {
	fov_octant(settings, data, +1, +1, 0, 1, true,  true,  1, 0.0, 1.0)
	fov_octant(settings, data, +1, +1, 1, 0, true,  false, 1, 0.0, 1.0)
	fov_octant(settings, data, +1, -1, 0, 1, false, true,  1, 0.0, 1.0)
	fov_octant(settings, data, +1, -1, 1, 0, false, false, 1, 0.0, 1.0)

	fov_octant(settings, data, -1, +1, 0, 1, true,  true,  1, 0.0, 1.0)
	fov_octant(settings, data, -1, +1, 1, 0, true,  false, 1, 0.0, 1.0)
	fov_octant(settings, data, -1, -1, 0, 1, false, true,  1, 0.0, 1.0)
	fov_octant(settings, data, -1, -1, 1, 0, false, false, 1, 0.0, 1.0)
}

/*
 * settings = {
 *   shape: FOV_SHAPE_CIRCLE,
 *   opaque: function (map, x, y) { return true; },
 *   opaque_apply: true,
 *   apply: function (map, x, y, sx, sy, s) { }
 * }
 */

function fov_circle(settings, map, source_x, source_y, radius) {
	data = {
		map: map,
		source: [source_x, source_y],
		radius: radius,
	}
	_fov_circle(settings, data);
}

return {
	circle: fov_circle,
	//SHAPE_CIRCLE_PRECALCULATE: FOV_SHAPE_CIRCLE_PRECALCULATE,
	SHAPE_CIRCLE: FOV_SHAPE_CIRCLE,
	SHAPE_OCTAGON: FOV_SHAPE_OCTAGON,
};

})();
