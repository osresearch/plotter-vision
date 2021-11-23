/*
 * Parse binary STL files into a list of triangles.
 *
 * Supports projecting them with a camera
 * and doing hidden-line removal.
 */

const stl_key2d_scale = 16;

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

function stl_ascii(content)
{
	let vertex = [];

	// super simple attempt to just convert every three line triple
	// of vertices into a XYZ point
	content.replace(/vertex\s+([^\s]+\s+[^\s]+\s+[^\s]+)/g, (match, verts) => {
		//console.log(verts);
		const coords = verts.split(/\s+/);
		vertex.push(createVector(
			float(coords[0]),
			float(coords[1]),
			float(coords[2]),
		));
	});

	console.log("vertex count = ", vertex.length);

	let triangles = [];
	for(let i = 0 ; i < vertex.length ; i += 3)
	{
		triangles.push(new Triangle(
			vertex[i+0],
			vertex[i+1],
			vertex[i+2],
		));
	}

	return triangles;
}

function stl_binary(rawbytes)
{
	const bytes = new DataView(rawbytes.buffer);
	const len = rawbytes.length;
	console.log(len, bytes);
	const num_triangles = bytes.getUint32(80, 1); // little endian
	console.log(num_triangles + " triangles");

	// sanity check the size
	let triangle_size = (3 + 9) * 4 + 2;
	let expected_size = 80 + 4 + num_triangles * triangle_size;

	let triangles = [];

	if (expected_size != len)
	{
		console.log("Expected " + expected_size + " for " + num_triangles + " triangles, got " + len + " bytes");
		// throw?
		return triangles;
	}


	for (let offset = 84 ; offset < len ; offset += 50)
	{
		triangles.push(new Triangle(
			parse_xyz(bytes, offset + 12),
			parse_xyz(bytes, offset + 24),
			parse_xyz(bytes, offset + 36),
		));
	}

	return triangles;
}


function STL(content)
{
	const rawbytes = new Uint8Array(content);
	const txtbytes = new TextDecoder("utf-8").decode(rawbytes)

	// heuristic to detect ASCII formatted files
	if (txtbytes.substr(0,6) == "solid ") {
		this.triangles = stl_ascii(txtbytes);
	} else {
		this.triangles = stl_binary(rawbytes);
	}

	// trade some accuracy for faster rendering and better drawing
	this.min_length = 5;

	// map the STL vertices within a fraction of a pixel
	// so that coplanar mapping can be done much more quickly.
	this.done_coplanar = 0;
	this.model_map = {};

	for(let t of this.triangles)
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
		this.visible_segments = [];
		this.segments = [];
		this.coplanar = [];

		// project the triangles into the screen mapping
		console.log("projecting triangles");
		for(let t of this.triangles)
			this.project_triangle(t, camera);

		// sort the screen mapped triangles by Z
		console.log("sorting triangles");
		for(let key in this.screen_map)
			this.screen_map[key].sort((a,b) => a.min.z - b.min.z);
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

		if (dist2(t0,t1) > this.min_length)
		{
			if (t.coplanar & 1)
				this.coplanar.push({ p0: t0, p1: t1 });
			else
				this.segments.push({ p0: t0, p1: t1 });
		}

		if (dist2(t1,t2) > this.min_length)
		{
			if (t.coplanar & 2)
				this.coplanar.push({ p0: t1, p1: t2 });
			else
				this.segments.push({ p0: t1, p1: t2 });
		}

		if (dist2(t2,t0) > this.min_length)
		{
			if (t.coplanar & 4)
				this.coplanar.push({ p0: t2, p1: t0 });
			else
				this.segments.push({ p0: t2, p1: t0 });
		}


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
			let visible_segment = hidden_wire(s, this.screen_map, this.segments);
			if (visible_segment)
				this.visible_segments.push(visible_segment);
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

	this.find_closest_vector = function(x,y,workq)
	{
		let best_dist = 1e9;
		let best_index = -1;
		let best = null;
		let do_reverse = false;

		for(let i = 0 ; i < workq.length ; i++)
		{
			const vec = workq[i];
			if (!vec)
				continue;

			let dx0 = vec.p0.x - x;
			let dy0 = vec.p0.y - y;
			let dist0 = dx0*dx0 + dy0*dy0;
			if (dist0 < best_dist)
			{
				best = vec;
				best_index = i;
				best_dist = dist0;
				do_reverse = false;
			}

			let dx1 = vec.p1.x - x;
			let dy1 = vec.p1.y - y;
			let dist1 = dx1*dx1 + dy1*dy1;
			if (dist1 < best_dist)
			{
				best = vec;
				best_index = i;
				best_dist = dist1;
				do_reverse = true;
			}
		}

		if (!best)
			return null;

		workq[best_index] = null;
		if (do_reverse)
		{
			const temp = best.p0;
			best.p0 = best.p1;
			best.p1 = temp;
		}

		return best;
	}

	// compute which of the nine possible outcodes the point is in
	// relative to the viewing window
	this.outcode = function(p,xmin,xmax,ymin,ymax)
	{
		let outcode = 0;
		if (p.x < xmin)
			outcode |= 0b0001;
		else
		if (p.x > xmax)
			outcode |= 0b0010;

		if (p.y < ymin)
			outcode |= 0b0100;
		else
		if (p.y > ymax)
			outcode |= 0b1000;

		return outcode;
	}

	this.clip_to_win = function(p0,p1,xmin,xmax,ymin,ymax)
	{
		// check to see if a vector is partially
		// on screen and if so, truncate it to screen
		// cordinates using the Cohen–Sutherland algorithm
		let outcode0 = this.outcode(p0,xmin,xmax,ymin,ymax);
		let outcode1 = this.outcode(p1,xmin,xmax,ymin,ymax);

		// both points share an outside,
		// so the segment is entirely outside
		if ((outcode0 & outcode1) != 0)
			return null;

		// both points are inside, so
		// the segment is entirely visible
		if ((outcode0 | outcode1) == 0)
			return [p0,p1];

		// at least one is outside the clip
		let outcode = outcode1 > outcode0 ? outcode1 : outcode0;
		let dx = p1.x - p0.x;
		let dy = p1.y - p0.y;
		let x, y;
		if (outcode & 0b1000)
		{
			// point is above
			x = p0.x + dx * (ymax - p0.y) / dy;
			y = ymax;
		} else
		if (outcode & 0b0100)
		{
			// point is below
			x = p0.x + dx * (ymin - p0.y) / dy;
			y = ymin;
		} else
		if (outcode & 0b0010)
		{
			// point is to the right
			x = xmax;
			y = p0.y + dy * (xmax - p0.x) / dx;
		} else
		if (outcode & 0b0001)
		{
			// point is to the left
			x = xmin;
			y = p0.y + dy * (xmin - p0.x) / dx;
		}

		if (outcode == outcode0)
		{
			p0.x = x;
			p0.y = y;
		} else {
			p1.x = x;
			p1.y = y;
		}

		// trim the other side
		return this.clip_to_win(p0,p1,xmin,xmax,ymin,ymax);
	}

	this.svg_path = function()
	{
		// create a list of vectors, removing any duplicates
		// and sorting by x value
		const duplicates = {};
		let workq = this.visible_segments.map(s => {
			let pts = this.clip_to_win(
				s.p0, s.p1,
				-width/2, width/2,
				-height/2, height/2);
			if (!pts)
				return null;

			let p0 = pts[0];
			let p1 = pts[1];

			if (p1.x < p0.x)
			{
				p0 = pts[1];
				p1 = pts[0];
			}

			// create the string form to track duplicates
			const str = p0.x.toFixed(4) + "," + p0.y.toFixed(4) +
				" " +
				p1.x.toFixed(4) + "," + p1.y.toFixed(4);

			if (str in duplicates)
				return null;
			duplicates[str] = 1;
			return { p0: p0, p1: p1 };
		});

		let ox = 0;
		let oy = 0;
		let path = '';
		let vec;
		while (vec = this.find_closest_vector(ox,oy,workq))
		{
			let sx = vec.p0.x;
			let sy = vec.p0.y;
			let ex = vec.p1.x;
			let ey = vec.p1.y;
			let x0 = sx + width / 2;
			let x1 = ex + width / 2;

			let y0 = height/2 - sy;
			let y1 = height/2 - ey;

			if (sx != ox || sy != oy)
			{
				// start a new line
				path += "\nM " +
				x0.toFixed(4) + "," +
				y0.toFixed(4) + " ";
			}

			// draw a segment to the end
			path += " L " +
				x1.toFixed(4) + "," +
				y1.toFixed(4)

			// and start searching from the end of this line
			ox = ex;
			oy = ey;
		};

		return path + "\n";
	};

}

