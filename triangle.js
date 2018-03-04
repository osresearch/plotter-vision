
function tri_normal(p0,p1,p2)
{
	let v0 = p5.Vector.sub(p1, p0);
	let v1 = p5.Vector.sub(p2, p0);
	return v0.cross(v1).normalize();
}

function Triangle(p0, p1, p2)
{

	this.model = [p0,p1,p2];
	this.normal = tri_normal(p0,p1,p2);

	// projection into the screen space and the camera generation
	// counter that was used to compute it
	this.generation = 0;
	this.screen = [];

	// bitmask of which of the three edges are coplanar
	// with other triangles
	this.coplanar = 0;

	// boolean for if this entire triangle is hidden due to
	// either off-screen or backface culling
	this.invisible = false;


	// compute the coordinates in screen space and decide
	// if it is onscreen or backfaced culled
	this.project = function (camera,generation) {
		this.generation = generation;
		this.invisible = true; // assume it will be discarded
		this.screen = [];

		let s0 = camera.project(this.model[0]);
		let s1 = camera.project(this.model[1]);
		let s2 = camera.project(this.model[2]);

		// if any of them are behind us or off screen,
		// mark this triangle as invisible
		if (!s0 || !s1 || !s2)
			return false;

		if((s0.x < -camera.width/2 || camera.width/2 < s0.x)
		|| (s0.y < -camera.height/2 || camera.height/2 < s0.y)
		|| (s1.x < -camera.width/2 || camera.width/2 < s1.x)
		|| (s1.y < -camera.height/2 || camera.height/2 < s1.y)
		|| (s2.x < -camera.width/2 || camera.width/2 < s2.x)
		|| (s2.y < -camera.height/2 || camera.height/2 < s2.y)
		)
			return false;

		// compute the screen normal and mark this triangle
		// as invisible if it is facing away from us
		let normal = tri_normal(s0,s1,s2);
		if (normal.z > 0)
			return false;

		// after all that, the triangle is visible
		this.screen = [s0,s1,s2];
		this.invisible = false;
		return true;
	};
}


