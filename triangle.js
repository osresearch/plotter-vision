
function tri_normal(p0,p1,p2)
{
	let v0 = v3sub(v3copy(p1), p0);
	let v1 = v3sub(v3copy(p2), p0);
	return v3normalize(v3cross(v0,v1));
}



let triangle_id = 0;

function Triangle(p0, p1, p2)
{
	this.id = triangle_id++;
	this.model = [p0,p1,p2];
	this.normal = tri_normal(p0,p1,p2);
	this.screen = [ v3new(), v3new(), v3new() ];
	this.min = v3new();
	this.max = v3new();
	this.t1 = v3new();
	this.t2 = v3new();

	// projection into the screen space and the camera generation
	// counter that was used to compute it
	this.generation = 0;

	// bitmask of which of the three edges are coplanar
	// with other triangles
	this.coplanar = 0;

	// boolean for if this entire triangle is hidden due to
	// either off-screen or backface culling
	this.invisible = false;


	// compute the coordinates in screen space and decide
	// if it is onscreen or backfaced culled
	this.project = function (camera,generation)
	{
		this.generation = generation;
		this.invisible = true; // assume it will be discarded

		let s0 = camera.project(this.model[0], this.screen[0]);
		let s1 = camera.project(this.model[1], this.screen[1]);
		let s2 = camera.project(this.model[2], this.screen[2]);

		// if any of them are behind us, mark this triangle as invisible
		if (s0[2] < 0 || s1[2] < 0 || s2[2] < 0)
			return false;

		// if all three points are off screen then discard this triangle
		// but keep it if any one is on screen.
		let w = camera.width;
		let h = camera.height;

		if (!onscreen(s0, w, h)
		&&  !onscreen(s1, w, h)
		&&  !onscreen(s2, w, h))
			return false;

		// compute the screen normal and mark this triangle
		// as invisible if it is facing away from us
		let normal = tri_normal(s0,s1,s2);
		if (normal[2] < 0)
			return false;

		// after all that, the triangle is visible
		this.invisible = false;

		// cache the min/max coordinates for a bounding box
		v3min3(this.min, s0, s1, s2);
		v3max3(this.max, s0, s1, s2);

		// compute the coordinates of the other two points,
		// relative to the first screen coordinate point
		this.t1 = v3sub(v3copy(s1), s0);
		this.t2 = v3sub(v3copy(s2), s0);

		return true;
	};

	// determines if this triangle shares any edges with
	// other triangle.  returns a bitmask of the shared edges
	// this only needs to be done once when the STL is loaded
	// but does require N^2 time so it should be deferred
	this.coplanar_check = function (t)
	{
		// ignore t if it is the same triangle
		if (t === this)
			return 0;

		// if the normals aren't "close enough" then
		// they can't be coplanar
		if (!close_enough(this.normal, t.normal))
			return 0;

		// do we have any point matches?
		let matches = 0;
		for(let i = 0 ; i < 3 ; i++)
			for(let j = 0 ; j < 3 ; j++)
				if (close_enough(this.model[i], t.model[j]))
					matches |= 1 << i;

		// points 0 and 1 == edge 0
		if (matches == 0b011) return 1 << 0;

		// points 1 and 2 == edge 1
		if (matches == 0b110) return 1 << 1;

		// points 0 and 2 == edge 2
		if (matches == 0b101) return 1 << 2;

		// all three points match; this must be a duplicate
		// triangle of some sort.
		if (matches == 0b111)
			console.log("three points match? " + this + " " + t);

		return 0;
	}

	// process a list of triangles and update the coplanar field
	this.coplanar_update = function (triangle_map)
	{
		// for each point in the triangle, look at the points
		// that potentially match the point
		for(let p of this.model)
		{
			for(let t of triangle_map[stl_key3d(p)])
			{
				let edges = this.coplanar_check(t);
				if (edges == 0)
					continue;

				this.coplanar |= edges;

				// if all three edges are matched, we can stop
				// searching since this triangle will not be
				// displayed anyway
				if (this.coplanar == 0b111)
					return;
			}
		}
	}

	// compute the barycentric coordinates for a point in screen space
	// and the screen Z of the point on the triangle
	// this can be used to determine if a point is inside or outside
	// of a triangle
	this.bary_coord = function (p)
	{
		let t1 = this.t1;
		let t2 = this.t2;
		let px = p[0] - this.screen[0][0];
		let py = p[1] - this.screen[0][1];

		let d = t1[0] * t2[1] - t2[0] * t1[1];
		let a = (px * t2[1] - py * t2[0]) / d;
		let b = (py * t1[0] - px * t1[1]) / d;

		return createVector(
			a,
			b,
			this.screen[0][2] + a * t1[2] + b * t2[2],
		);
	}
}


