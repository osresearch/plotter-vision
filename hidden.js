/*
 * Given a triangle and a line segment in screen coordintes,
 * determine if the line segment is occluded by the triangle.
 *
 * Negative Z distance is behind the camera,
 * Increasing Z is further away
 *
 * Returns:
 */
const tri_no_occlusion = 0; // no occlusion and processing should continue
const tri_in_front = 1; // no occlusion and processing should stop
const tri_hidden = 2; // occlusion and the segment is totally hidden
const tri_clipped = 3; // occlusion and either p0 or p1 has been updated
const tri_split = 4; //  occlusion and p0/p1 have been updated and p2/p3 have been created
const EPS = 0.000001;

let p_max = null;
let p_min = null;

function occlude(t,s,work_queue)
{
	// if this triangle is not visible, then we don't process it
	// since the screen coordinates might be invalid,
	// so this function should not have been called
	if (t.invisible)
		return tri_no_occlusion;

	// if the segment is too short in screen space we are done
	let seg_len = dist2(s.p1, s.p0);
	if (seg_len < 1)
		return tri_hidden;

	if (!p_max) p_max = createVector();
	if (!p_min) p_min = createVector();

	v3max(p_max, s.p0, s.p1);
	v3min(p_min, s.p0, s.p1);

	// if the segment max z is closer than the minimum
	// z of the triangle, then this triangle can not occlude
	if (p_max.z <= t.min.z)
		return tri_in_front;

	// perform a screen coordinates bounding box check for the
	// triangle min/max.
	// if the segment lies outside of this box and doesn't
	// cross it, then there is no chance of occlusion
	if (p_max.x < t.min.x || t.max.x < p_min.x)
		return tri_no_occlusion;
	if (p_max.y < t.min.y || t.max.y < p_min.y)
		return tri_no_occlusion;

	// there is a chance this segment crosses the triangle,
	// so compute the barycentric coordinates in triangle space
	let tp0 = t.bary_coord(s.p0);
	let tp1 = t.bary_coord(s.p1);

	// if both are inside and not both on the same edge
	// (which would indicate that this segment came from this
	// triangle), then it is totally occluded
	if (inside(tp0) && inside(tp1))
	{
		// if the segment z is closer than the triangle z
		// then the segment is in front of the triangle
		// equality check in case the segment shares a vertex
		// with the triangle.  If it is coming towards the
		// camera in the other point, the no occlusion.
		if (s.p0.z < tp0.z+EPS && s.p1.z < tp1.z+EPS)
			return tri_no_occlusion;

		// this segment either punctures the triangle
		// or something is bad about it.  ignore the other cases
		return tri_hidden;
	}

	// one or neither of the points are totally occluded
	// so find where the extended triangle edge lines intersect
	// the extended segment line.
	let ratios = [];
	let intercept_s = [];
	let intercept_t = [];
	let intercepts = 0;

	for(let i = 0 ; i < 3 ; i++)
	{
		let [ratio, is, it] = intercept_lines(
			s.p0,
			s.p1,
			t.screen[i],
			t.screen[(i+1) % 3],
		);
		if (ratio < 0)
			continue;

		// if the segment intercept is closer than the triangle
		// intercept, then this does not count as an intersection
		if (is.z <= it.z)
			continue;

		intercepts++;
		intercept_s.push(is);
		intercept_t.push(it);
	}

	let original_intercepts = intercepts;

	// if none of the intersections are within the lines,
	// then there is no possibility of occlusion
	if (intercepts == 0)
		return tri_no_occlusion;

	// for tangent lines it is possible that the intercepts
	// might be the same.  check and remove the duplicates if so
	if (intercepts == 3)
	{
		if (close_enough(intercept_s[0], intercept_s[2]))
		{
			intercepts--;
		} else
		if (close_enough(intercept_s[1], intercept_s[2]))
		{
			intercepts--;
		} else
		if (close_enough(intercept_s[0], intercept_s[1]))
		{
			intercept_s[1] = intercept_s[2];
			intercept_t[1] = intercept_t[2];
			intercepts--;
		} else {
			// this should never happen, unless there are very small triangles
			// in which case we discard this triangle
			return tri_hidden;
		}
	}

	if (intercepts == 2)
	{
		if (close_enough(intercept_s[0], intercept_s[1]))
			intercepts--;
	}

	// one intercept should mean that only one point is inside
	if (intercepts == 1)
	{
		if (inside(tp0))
		{
			// clipped from is0 to p1
			s.p0 = intercept_s[0];
			return tri_clipped;
		}
		if (inside(tp1))
		{
			// clipped from p0 to is0
			s.p1 = intercept_s[0];
			return tri_clipped;
		}

		// this might be a tangent, so nothing is clipped
		return tri_no_occlusion;
	}

	// two intercept: figure out which intercept point is closer
	// to which point and create a new segment
	let d00 = dist2(intercept_s[0], s.p0);
	let d01 = dist2(intercept_s[1], s.p0);
	let d10 = dist2(intercept_s[0], s.p1);
	let d11 = dist2(intercept_s[1], s.p1);

	if (d00 < EPS && d11 < EPS)
		return tri_hidden;
	if (d01 < EPS && d10 < EPS)
		return tri_hidden;

	if (d00 < EPS)
	{
		s.p0 = intercept_s[1];
		return tri_clipped;
	} else
	if (d01 < EPS)
	{
		s.p0 = intercept_s[0];
		return tri_clipped;
	} else
	if (d10 < EPS)
	{
		s.p1 = intercept_s[1];
		return tri_clipped;
	} else
	if (d11 < EPS)
	{
		s.p1 = intercept_s[0];
		return tri_clipped;
	}

	// neither end point matches, so we'll create a new
	// segment that excludes the space between is0 and is1
	let midpoint = d00 > d01 ? 1 : 0;

	work_queue.push({
		p0: s.p0,
		p1: intercept_s[midpoint],
	});

	s.p0 = intercept_s[midpoint ? 0 : 1];

	return tri_split;
}


// Returns true if a barycentric coordinate is inside the triangle
function inside(pb)
{
	let a = pb.x;
	let b = pb.y;
	return -EPS <= a && -EPS <= b && a + b <= 1 + EPS;
}

function dist2(p0,p1)
{
	let dx = p0.x - p1.x;
	let dy = p0.y - p1.y;
	return dx*dx + dy*dy;
}


// returns the ratio along the segment of the intercept and if
// this occurs on the segment both of the z points
//
// this solves only the 2D "orthographic" case for the X and Y
// coordinates
function intercept_lines(p0,p1,p2,p3)
{
	let s0 = p5.Vector.sub(p1,p0);
	let s1 = p5.Vector.sub(p3,p2);

	// compute s0 x s1
	let d = s0.x * s1.y - s1.x * s0.y

	// if they are close to parallel then we define that
	// as non-intersecting
	if (-EPS < d && d < EPS)
		return [-1,null,null];

	// compute how far along each line they would intersect
	let r0 = (s1.x * (p0.y - p2.y) - s1.y * (p0.x - p2.x)) / d;
	let r1 = (s0.x * (p0.y - p2.y) - s0.y * (p0.x - p2.x)) / d;

	// if they are outside of (0,1) then the intersection
	// occurs outside of either segment and are non-intersecting
	if (r0 < 0 || r0 > 1
	||  r1 < 0 || r1 > 1)
		return [-1,null,null];

	// compute the points of intersections for the two
	// segments as p + r * s
	s0.mult(r0).add(p0);
	s1.mult(r1).add(p2);

	return [r0, s0, s1];
}


// Process a segment against a list of triangles
// returns a list of segments that are visible
// TODO: best if triangles is sorted by z depth
// TODO: figure out a better representation for the screen map
function hidden_wire(s, screen_map, work_queue)
{
	let segments = [];

	let min_key_x = Math.trunc(Math.min(s.p0.x, s.p1.x) / stl_key2d_scale);
	let min_key_y = Math.trunc(Math.min(s.p0.y, s.p1.y) / stl_key2d_scale);
	let max_key_x = Math.trunc(Math.max(s.p0.x, s.p1.x) / stl_key2d_scale);
	let max_key_y = Math.trunc(Math.max(s.p0.y, s.p1.y) / stl_key2d_scale);

	for(let x = min_key_x ; x <= max_key_x ; x++)
	{
		for(let y = min_key_y ; y <= max_key_y ; y++)
		{
			let triangles = screen_map[x + "," + y];
			if (!triangles)
				continue;

	for(let t of triangles)
	{
		if (t.invisible)
			continue;

		let rc = occlude(t, s, work_queue);

		// this segment is no longer visible,
		// but any new segments that it has added to the array
		// will be processed against the triangles again.
		if (rc == tri_hidden)
			return null;

		if (rc == tri_in_front)
		{
			// this line segment is entirely in front of
			// this triangle, which means that no other
			// triangles on the sorted list can occlude
			// the segment, so we're done.
			break;
		}

		if (rc == tri_clipped
		||  rc == tri_no_occlusion)
			continue;

		if (rc == tri_split)
		{
			if (verbose)
				console.log("split", s.p0,s.p1, t);
			continue;
		}

		// huh?
		console.log("occlude() returned? ", rc)
	}
		}
	}

	// if we have made it all the way here, the remaining part
	// of this segment is visible and should be added to the draw list
	return s;
}
