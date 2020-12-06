
function tri_normal(p0,p1,p2)
{
	let v0 = p5.Vector.sub(p1, p0);
	let v1 = p5.Vector.sub(p2, p0);
	return v0.cross(v1).normalize();
}



function v3min(out,v0,v1)
{
	out.x = Math.min(v0.x, v1.x);
	out.y = Math.min(v0.y, v1.y);
	out.z = Math.min(v0.z, v1.z);
}

function v3max(out,v0,v1)
{
	out.x = Math.max(v0.x, v1.x);
	out.y = Math.max(v0.y, v1.y);
	out.z = Math.max(v0.z, v1.z);
}

function close_enough(p0,p1)
{
	let eps = 0.0001;

	let dx = p0.x - p1.x;
	if (dx < -eps || eps < dx)
		return false;

	let dy = p0.y - p1.y;
	if (dy < -eps || eps < dy)
		return false;

	let dz = p0.z - p1.z;
	if (dz < -eps || eps < dz)
		return false;

	return true;
}

function onscreen(p, w, h)
{
	if (p.x < -w/2 || w/2 < p.x)
		return false;
	if (p.y < -h/2 || h/2 < p.y)
		return false;
	return true;
}

function Triangle(p0, p1, p2)
{

	this.model = [p0,p1,p2];
	this.normal = tri_normal(p0,p1,p2);
	this.screen = [ createVector(), createVector(), createVector() ];
	this.min = createVector();
	this.max = createVector();
	this.t1 = createVector();
	this.t2 = createVector();

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
		if (!s0 || !s1 || !s2)
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
		if (normal.z < 0)
			return false;

		// after all that, the triangle is visible
		this.invisible = false;

		// cache the min/max coordinates for a bounding box
		v3min(this.min, s0, s1);
		v3min(this.min, this.min, s2);

		v3max(this.max, s0, s1);
		v3max(this.max, this.max, s2);

		// compute the coordinates of the other two points,
		// relative to the first screen coordinate point
		this.t1.set(s1);
		this.t2.set(s2);
		this.t1.sub(s0);
		this.t2.sub(s0);

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
		for(p of this.model)
		{
			for(t of triangle_map[stl_key3d(p)])
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
		let px = p.x - this.screen[0].x;
		let py = p.y - this.screen[0].y;

		let d = t1.x * t2.y - t2.x * t1.y;
		let a = (px * t2.y - py * t2.x) / d;
		let b = (py * t1.x - px * t1.y) / d;

		return createVector(
			a,
			b,
			this.screen[0].z + a * t1.z + b * t2.z,
		);
	}
}


