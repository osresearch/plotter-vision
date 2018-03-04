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
const EPS = 0.0001;

function occlude(t,s,s_out)
{
	// if this triangle is not visible, then we don't process it
	// since the screen coordinates might be invalid,
	// so this function should not have been called
	if (t.invisible)
		return tri_no_occlusion;

	// if the segment is too short we are done
	let seg_len = p5.Vector.sub(s.p1,s.p0).magSq();
	if (seg_len < 0.1)
		return tri_hidden;

	let p_max = v3max(s.p0,s.p1);
	let p_min = v3min(s.p0,s.p1);

	// if the segment max z is closer than the minimum
	// z of the triangle, then this triangle can not occlude
	if (p_max.z <= t.min.z)
		return tri_in_front;

	// perform a bounding box check for the triangle min/max.
	// if the segment lies outside of this box and doesn't
	// cross it, then there is no chance of occlusion
	if (p_min.x < t.min.x && p_max.x < t.min.x)
		return tri_no_occlusion;
	if (p_min.y < t.min.y && p_max.y < t.min.y)
		return tri_no_occlusion;
	if (p_min.x > t.max.x && p_max.x > t.max.x)
		return tri_no_occlusion;
	if (p_min.y > t.max.y && p_max.y > t.max.y)
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
		if (s.p0.z < tp0.z && s.p1.z < tp1.z)
			return tri_no_occlusion;

		// if the barycentric coord is 0 on the same edge
		// for both points, then it is part of the original line
		// we have to re-compute the c coordinate 
		if (tp0.x < EPS && tp1.x < EPS)
			return tri_no_occlusion;
		if (tp0.y < EPS && tp1.y < EPS)
			return tri_no_occlusion;
		let c0 = 1.0 - tp0.x - tp0.y;
		let c1 = 1.0 - tp1.x - tp1.y;
		if (c0 < EPS && c1 < EPS)
			return tri_no_occlusion;

		// not on a triangle edge and not infront of
		// the triangle, so the segment is totally occluded
		// could we also just check for z coordinates?
		return tri_hidden;
	}

	return tri_no_occlusion;
}


// Returns true if a barycentric coordinate is inside the triangle
function inside(pb)
{
	let a = pb.x;
	let b = pb.y;
	return 0 <= a && 0 <= b && a + b <= 1 + EPS;
}


// Process a segment against a list of triangles
// returns a list of segments that are visible
// TODO: best if triangles is sorted by z depth
function hidden_wire(s, triangles, start_index)
{
	let segments = [];
	let new_segment = {};

	for(let i = start_index ; i < triangles.length ; i++)
	{
		let t = triangles[i];
		if (t.invisible)
			continue;

		let rc = occlude(triangles[i], s, new_segment);
		console.log("occlude rc=" + rc);
		if (rc == tri_hidden)
		{
			console.log("HIDDEN: " + s);
			console.log(segments);
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
			let new_segments = hidden_wire(new_segment, triangles, i+1);
			segments.concat(new_segments);
			new_segment = {};
			continue;
		}

		// huh?
	}

	// if we have made it all the way here, the remaining part
	// of this segment is visible and should be added to our list
	segments.push(s);
console.log("VISIBLE: " + segments.length);
console.log(s);
	return segments;
}
