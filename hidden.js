/*
 * Given a triangle and a line segment in screen coordintes,
 * determine if the line segment is occluded by the triangle.
 *
 * Returns:
 */
const tri_no_occlusion = 0; // no occlusion and processing should continue
const tri_in_front = 1; // no occlusion and processing should stop
const tri_hidden = 2; // occlusion and the segment is totally hidden
const tri_clipped = 3; // occlusion and either p0 or p1 has been updated
const tri_split = 4; //  occlusion and p0/p1 have been updated and p2/p3 have been created
const EPS = 0.00001;

function occlude(t,s)
{
	// if this triangle is not visible, then we don't process it
	// since the screen coordinates might be invalid,
	// so this function should not have been called
	if (t.invisible)
		return [tri_no_occlusion];

	// if the segment is too short in screen space we are done
	let seg_len = dist2(s.p1, s.p0);
	if (seg_len < 0.5)
		return [tri_hidden];

	let p_max = v3max(s.p0,s.p1);
	let p_min = v3min(s.p0,s.p1);

	// if the segment max z is closer than the minimum
	// z of the triangle, then this triangle can not occlude
	if (p_max.z <= t.min.z)
		return [tri_in_front];

	// perform a bounding box check for the triangle min/max.
	// if the segment lies outside of this box and doesn't
	// cross it, then there is no chance of occlusion
	if (p_min.x < t.min.x && p_max.x < t.min.x)
		return [tri_no_occlusion];
	if (p_min.y < t.min.y && p_max.y < t.min.y)
		return [tri_no_occlusion];
	if (p_min.x > t.max.x && p_max.x > t.max.x)
		return [tri_no_occlusion];
	if (p_min.y > t.max.y && p_max.y > t.max.y)
		return [tri_no_occlusion];

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
		if (s.p0.z < tp0.z && s.p1.z < tp1.z)
			return [tri_no_occlusion];

		// if the barycentric coord is 0 on the same edge
		// for both points, then it is part of the original line
		// we have to re-compute the c coordinate 
		if (tp0.x < EPS && tp1.x < EPS)
			return [tri_no_occlusion];
		if (tp0.y < EPS && tp1.y < EPS)
			return [tri_no_occlusion];
		let c0 = 1.0 - tp0.x - tp0.y;
		let c1 = 1.0 - tp1.x - tp1.y;
		if (c0 < EPS && c1 < EPS)
			return [tri_no_occlusion];

		// not on a triangle edge and not infront of
		// the triangle, so the segment is totally occluded
		// could we also just check for z coordinates?
/*
console.log("BOTH INSIDE");
console.log(s);
console.log(tp0);
console.log(tp1);
*/
		return [tri_hidden];
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
			t.screen[(i+1) %3],
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
		return [tri_no_occlusion];

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
		}
	}
	if (intercepts == 2)
	{
		if (close_enough(intercept_s[0], intercept_s[1]))
			intercepts--;
	}

	// this should never happen, unless there are very small triangles
	if (intercepts == 3)
		return [tri_no_occlusion];

	// one intercept should mean that only one point is inside
	if (intercepts == 1)
	{
		if (inside(tp0))
		{
			// clipped from is0 to p1
			s.p0 = intercept_s[0];
			return [tri_clipped];
		}
		if (inside(tp1))
		{
			// clipped from p0 to is0
			s.p1 = intercept_s[0];
			return [tri_clipped];
		}

		// this might be a tangent, so nothing is clipped
		return [tri_no_occlusion];
	}

	// two intercept: figure out which intercept point is closer
	// to which point and create a new segment
	let d00 = dist2(intercept_s[0], s.p0);
	let d01 = dist2(intercept_s[1], s.p0);
	let d10 = dist2(intercept_s[0], s.p1);
	let d11 = dist2(intercept_s[1], s.p1);

	if (d00 < EPS && d11 < EPS)
		return [tri_hidden];
	if (d01 < EPS && d10 < EPS)
		return [tri_hidden];

	if (d00 < EPS)
	{
		s.p0 = intercept_s[1];
		return [tri_clipped];
	} else
	if (d01 < EPS)
	{
		s.p0 = intercept_s[0];
		return [tri_clipped];
	} else
	if (d10 < EPS)
	{
		s.p1 = intercept_s[1];
		return [tri_clipped];
	} else
	if (d11 < EPS)
	{
		s.p1 = intercept_s[0];
		return [tri_clipped];
	}

	// neither end point matches, so we'll create a new
	// segment that excludes the space between is0 and is1
	let new_segment = {
		p0: intercept_s[ d00 < d01 ? 1 : 0 ],
		p1: s.p1,
	};
	s.p1 = intercept_s[ d00 < d01 ? 0 : 1 ];

	return [tri_split,new_segment];
}


// Returns true if a barycentric coordinate is inside the triangle
function inside(pb)
{
	let a = pb.x;
	let b = pb.y;
	return 0 <= a && 0 <= b && a + b <= 1 + EPS;
}

function dist2(p0,p1)
{
	return p5.Vector.sub(p1,p0).magSq();
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
function hidden_wire(s, screen_map)
{
	let segments = [];

	let min_key_x = Math.trunc(Math.min(s.p0.x, s.p1.x) / key_scale);
	let min_key_y = Math.trunc(Math.min(s.p0.y, s.p1.y) / key_scale);
	let max_key_x = Math.trunc(Math.max(s.p0.x, s.p1.x) / key_scale);
	let max_key_y = Math.trunc(Math.max(s.p0.y, s.p1.y) / key_scale);

	for(let x = min_key_x ; x <= max_key_x ; x++)
	{
		for(let y = min_key_y ; y <= max_key_y ; y++)
		{
			let triangles = screen_map[x + "," + y];
			if (!triangles)
				continue;

	for(t of triangles)
	{
		if (t.invisible)
			continue;

		let [rc,new_segment] = occlude(t, s);
		if (rc == tri_hidden)
		{
			return segments;
		}

		if (rc == tri_in_front)
		{
			// if the list were sorted, we would be done
			// and could return these segments
			continue;
		}

		if (rc == tri_clipped
		||  rc == tri_no_occlusion)
			continue;

		if (rc == tri_split)
		{
			let new_segments = hidden_wire(new_segment, screen_map);
			segments = segments.concat(new_segments);
			continue;
		}

		// huh?
	}
		}
	}

	// if we have made it all the way here, the remaining part
	// of this segment is visible and should be added to our list
	segments.push(s);
	return segments;
}
