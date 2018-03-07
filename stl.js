/*
 * Parse binary STL files into a list of triangles.
 *
 * Supports projecting them with a camera
 * and doing hidden-line removal.
 */

const stl_key2d_scale = 1;

function stl_key3d(p)
{
	return int(p.x*100) + "," + int(p.y*100) + "," +int(p.z*100);
}
function stl_key2d(p)
{
	return int(p.x/stl_key2d_scale) + "," + int(p.y/stl_key2d_scale);
}


function parse_xyz(bytes, offset)
{
	return createVector(
		bytes.getFloat32(offset+0, 1),
		bytes.getFloat32(offset+4, 1),
		bytes.getFloat32(offset+8, 1),
	);
}


function STL(rawbytes_arraybuffer)
{
	let bytes = new DataView(rawbytes_arraybuffer.buffer);
	let len = rawbytes_arraybuffer.length;
	let num_triangles = bytes.getUint32(80, 1); // little endian
	console.log(num_triangles + " triangles");

	// sanity check the size
	let triangle_size = (3 + 9) * 4 + 2;
	let expected_size = 80 + 4 + num_triangles * triangle_size;

	if (expected_size != len)
	{
		console.log("Expected " + expected_size + " for " + num_triangles + " triangles, got " + len + " bytes");
		// throw?
		//return;
	}

	this.triangles = [];

	for (let offset = 84 ; offset < len ; offset += 50)
	{
		this.triangles.push(new Triangle(
			parse_xyz(bytes, offset + 12),
			parse_xyz(bytes, offset + 24),
			parse_xyz(bytes, offset + 36),
		));
	}

	// map the STL vertices within a fraction of a pixel
	// so that coplanar mapping can be done much more quickly.
	this.done_coplanar = 0;
	this.model_map = {};

	for(t of this.triangles)
	{
		let k0 = stl_key3d(t.model[0]);
		let k1 = stl_key3d(t.model[1]);
		let k2 = stl_key3d(t.model[2]);

		if(this.model_map[k0])
			this.model_map[k0].push(t);
		else
			this.model_map[k0] = [t];

		if(this.model_map[k1])
			this.model_map[k1].push(t);
		else
			this.model_map[k1] = [t];

		if(this.model_map[k2])
			this.model_map[k2].push(t);
		else
			this.model_map[k2] = [t];
	}

	this.project = function(camera)
	{
		this.screen_map = {};
		this.hidden_segments = [];
		this.segments = [];

		for(t of this.triangles)
			this.project_triangle(t, camera);
	}

	this.project_triangle = function(t,camera)
	{
		if (t.generation == camera.generation)
			return;
		t.generation = camera.generation;
		t.project(camera);
		if (t.invisible)
			return;

		// this one is on screen, create segments for each
		// of its non-coplanar edges
		let t0 = t.screen[0];
		let t1 = t.screen[1];
		let t2 = t.screen[2];

		if ((t.coplanar & 1) == 0 && dist2(t0,t1) > 1)
			this.segments.push({ p0: t0, p1: t1 });
		if ((t.coplanar & 2) == 0 && dist2(t1,t2) > 1)
			this.segments.push({ p0: t1, p1: t2 });
		if ((t.coplanar & 4) == 0 && dist2(t2,t0) > 1)
			this.segments.push({ p0: t2, p1: t0 });


		// build the screen map for all of the sectors
		// that might contain this triangle's projection
		let min_key_x = Math.trunc(t.min.x/stl_key2d_scale);
		let min_key_y = Math.trunc(t.min.y/stl_key2d_scale);
		let max_key_x = Math.trunc(t.max.x/stl_key2d_scale);
		let max_key_y = Math.trunc(t.max.y/stl_key2d_scale);

		for(let x=min_key_x ; x <= max_key_x ; x++)
		{
			for(let y=min_key_y ; y <= max_key_y ; y++)
			{
				let key = x + "," + y;
				if (this.screen_map[key])
					this.screen_map[key].push(t);
				else
					this.screen_map[key] = [t];
			}
		}
	}


	// check the triangles in the model for coplanarity.
	// this can take a while, so the function only processes some
	// of the triangles per call.
	this.do_coplanar = function(camera,ms)
	{
		let num_triangles = this.triangles.length;
		if (this.done_coplanar >= num_triangles)
			return false;

		console.log("coplanar processing " + this.done_coplanar + "/" +num_triangles);
		let start_time = performance.now();

		while(this.done_coplanar < num_triangles)
		{
			let t = this.triangles[this.done_coplanar++];
			t.coplanar_update(this.model_map)

			if (performance.now() - start_time > ms)
				break;
		}

		this.project(camera);
		return true;
	}

	// check the visible segments for occlusion in all the triangles
	// that might occlude it.  this can take a while, so the function
	// only processes some of the segments per call.
	this.do_hidden = function(camera,ms)
	{
		let num_segments = this.segments.length;
		if (num_segments == 0)
			return false;

		let start_time = performance.now();

		// coplanar processing is done; find the hidden
		// line segments if they are not dragging
		let count = 0;

		while(this.segments.length != 0)
		{
			let s = this.segments.shift();
			let new_segments = hidden_wire(s, this.screen_map);
			this.hidden_segments = this.hidden_segments.concat(new_segments);
			count++;

			if (performance.now() - start_time > ms)
				break;
		}
		console.log("hidden processing " + count + " segments in " + int(performance.now() - start_time) + " ms");

		return true;
	}

	this.do_work = function(camera,ms)
	{
		if (this.do_coplanar(camera,ms))
			return true;
		if (this.do_hidden(camera,ms))
			return true;

		// no changes
		return false;
	}

}

