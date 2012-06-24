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

function fov_octant(settings, data, signx, signy, rx, dx, start_slope, end_slope) {
  var ry = 1-rx;
  var apply_edge = (signy == 1);
  var apply_diag = (rx == 0);
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
				fov_octant(settings, data, signx, signy, rx, dx+1, start_slope, end_slope_next);
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
		fov_octant(settings, data, signx, signy, rx, dx+1, start_slope, end_slope);
	}
}

function _fov_circle(settings, data) {
	fov_octant(settings, data, +1, +1, 0, 1, 0, 1);
	fov_octant(settings, data, +1, +1, 1, 1, 0, 1);
	fov_octant(settings, data, +1, -1, 0, 1, 0, 1);
	fov_octant(settings, data, +1, -1, 1, 1, 0, 1);

	fov_octant(settings, data, -1, +1, 0, 1, 0, 1);
	fov_octant(settings, data, -1, +1, 1, 1, 0, 1);
	fov_octant(settings, data, -1, -1, 0, 1, 0, 1);
	fov_octant(settings, data, -1, -1, 1, 1, 0, 1);
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
	var data = {
		map: map,
		source: [source_x, source_y],
		radius: radius,
	}
	_fov_circle(settings, data);
}

/**
 * Limit x to the range [a, b].
 */
function betweenf(x, a, b) {
    if (x - a < FLT_EPSILON) { /* x < a */
        return a;
    } else if (x - b > FLT_EPSILON) { /* x > b */
        return b;
    } else {
        return x;
    }
}

function fov_octant2(settings, data, p, q, dx, start_slope, end_slope) {
  fov_octant(settings, data, p[0], p[1], p[2], dx, start_slope, end_slope);
  fov_octant(settings, data, q[0], q[1], q[2], dx, start_slope, end_slope);
};

//function fov_octant(settings, data, signx, signy, rx, dx, start_slope, end_slope) {
function BEAM_DIRECTION(settings, data, direction, a, d, p1, p2, p3, p4, p5, p6, p7, p8) {
  if (direction == d) {                                   
    var end_slope = betweenf(a, 0, 1);                
    fov_octant2(settings, data, p1, p2, 1, 0, end_slope);         
    if (a - 1 > FLT_EPSILON) { /* a > 1 */        
      var start_slope = betweenf(2 - a, 0, 1);   
      fov_octant2(settings, data, p3, p4, 1, start_slope, 1);   
    }                                                   
    if (a - 2 > FLT_EPSILON) { /* a > 2 */        
      var end_slope = betweenf(a - 2, 0, 1);     
      fov_octant2(settings, data, p5, p6, 1, 0, end_slope);     
    }                                                   
    if (a - 3 > FLT_EPSILON) { /* a > 3 */        
      var start_slope = betweenf(4 - a, 0, 1);   
      fov_octant2(settings, data, p7, p8, 1, start_slope, 1);   
    }                                                   
  }
}

function BEAM_DIRECTION_DIAG(settings, data, direction, a, d, p1, p2, p3, p4, p5, p6, p7, p8) {
  if (direction == d) {                                       
    var start_slope = betweenf(1 - a, 0, 1);           
    fov_octant2(settings, data, p1, p2, 1, start_slope, 1);           
    if (a - 1 > FLT_EPSILON) { /* a > 1 */            
      var end_slope = betweenf(a - 1, 0, 1);         
      fov_octant2(settings, data, p3, p4, 1, 0, end_slope);         
    }                                                       
    if (a - 2 > FLT_EPSILON) { /* a > 2 */            
      var start_slope = betweenf(3 - a, 0, 1);       
      fov_octant2(settings, data, p5, p6, 1, start_slope, 1);       
    }                                                       
    if (a - 3 > FLT_EPSILON) { /* a > 3 */            
      var end_slope = betweenf(a - 3, 0, 1);         
      fov_octant2(settings, data, p7, p8, 1, 0, end_slope);         
    }                                                       
  }
}

function fov_beam(settings, map, source_x, source_y, radius, direction, angle) {
  var data = {
    map: map,
    source: [source_x, source_y],
    radius: radius
  };

  if (angle <= 0) {
    return;
  } else if (angle >= 2*Math.PI) {
    _fov_circle(settings, data);
    return;
  }

  /* Calculate the angle as a percentage of 45 degrees, halved (for
   * each side of the centre of the beam). e.g. angle = 180 means
   * half the beam is 90.0 which is 2x45, so the result is 2.0.
   */
  var a = (angle * 2 / Math.PI);

  var ppn = [1,1,0], ppy = [1,1,1];
  var pmn = [1,-1,0], pmy = [1,-1,1];
  var mpn = [-1,1,0], mpy = [-1,1,1];
  var mmn = [-1,-1,0], mmy = [-1,-1,1];
  BEAM_DIRECTION(settings, data, direction, a, 'east', ppn, pmn, ppy, mpy, pmy, mmy, mpn, mmn);
  BEAM_DIRECTION(settings, data, direction, a, 'west', mpn, mmn, pmy, mmy, ppy, mpy, ppn, pmn);
  BEAM_DIRECTION(settings, data, direction, a, 'north', mpy, mmy, mmn, pmn, mpn, ppn, pmy, ppy);
  BEAM_DIRECTION(settings, data, direction, a, 'south', pmy, ppy, mpn, ppn, mmn, pmn, mmy, mpy);
  BEAM_DIRECTION_DIAG(settings, data, direction, a, 'northeast', pmn, mpy, mmy, ppn, mmn, ppy, mpn, pmy);
  BEAM_DIRECTION_DIAG(settings, data, direction, a, 'northwest', mmn, mmy, mpn, mpy, pmy, pmn, ppy, ppn);
  BEAM_DIRECTION_DIAG(settings, data, direction, a, 'southeast', ppn, ppy, pmy, pmn, mpn, mpy, mmn, mmy);
  BEAM_DIRECTION_DIAG(settings, data, direction, a, 'southwest', pmy, mpn, ppy, mmn, ppn, mmy, pmn, mpy);
}

return {
	circle: fov_circle,
  beam: fov_beam,
	//SHAPE_CIRCLE_PRECALCULATE: FOV_SHAPE_CIRCLE_PRECALCULATE,
	SHAPE_CIRCLE: FOV_SHAPE_CIRCLE,
	SHAPE_OCTAGON: FOV_SHAPE_OCTAGON,
};

})();
