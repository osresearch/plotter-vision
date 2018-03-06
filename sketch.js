/*
 * Parse a binary STL file into a list of triangles
 * Header (84 bytes):
 *   80 byte header
 *   uint32_t number of triangles
 *
 * Triangle (50 bytes)
 *   3 32-bit float normals
 *   9 32-bit float x,y,z tripples
 *   uint16_t attributes (ignored)
 */

let x_offset;
let y_offset;
let z_scale = 10;

let stl = false;
let stl_map = false;
let key_scale = 1;
let screen_map = false;
let camera, eye, lookat, up;
let fov;
let redraw = false;
let reproject = false;
let done_coplanar;
let segments = [];
let hidden_segments = [];



function parse_xyz(bytes, offset)
{
	return createVector(
		bytes.getFloat32(offset+0, 1),
		bytes.getFloat32(offset+4, 1),
		bytes.getFloat32(offset+8, 1),
	);
}


function parse_stl_binary(raw_bytes)
{
	let bytes = new DataView(raw_bytes.buffer);
	let num_triangles = bytes.getUint32(80, 1); // little endian
	console.log(num_triangles + " triangles");

	// sanity check the size
	let triangle_size = (3 + 9) * 4 + 2;
	let expected_size = 80 + 4 + num_triangles * triangle_size;

	if (expected_size != raw_bytes.length)
	{
		console.log("Expected " + expected_size + " for " + num_triangles + " triangles, got " + raw_bytes.length + " bytes");
		//return;
	}


	let triangles = [];

	for (let offset = 84 ; offset < raw_bytes.length ; offset += 50)
	{
		triangles.push(new Triangle(
			parse_xyz(bytes, offset + 12),
			parse_xyz(bytes, offset + 24),
			parse_xyz(bytes, offset + 36),
		));
	}

	console.log(triangles);
	done_coplanar = 0;
	redraw = true;

	return triangles;
}


function stl_key(p)
{
	return int(p.x*100) + "," + int(p.y*100) + "," +int(p.z*100);
}

// map the STL vertices within a fraction of a pixel
function stl_vertex(triangles)
{
	let m = {};
	for(t of triangles)
	{
		let k0 = stl_key(t.model[0]);
		let k1 = stl_key(t.model[1]);
		let k2 = stl_key(t.model[2]);

		if(m[k0]) m[k0].push(t); else m[k0] = [t];
		if(m[k1]) m[k1].push(t); else m[k1] = [t];
		if(m[k2]) m[k2].push(t); else m[k2] = [t];
	}

	return m;
}


function stl_reproject(triangles)
{
	screen_map = {};
	hidden_segments = [];
	segments = [];

	for(t of stl)
	{
		if (t.generation == camera.generation)
			continue;
		t.generation = camera.generation;
		t.project(camera);
		if (t.invisible)
			continue;

		// this one is on screen, create segments for each
		// of its non-coplanar edges
		let t0 = t.screen[0];
		let t1 = t.screen[1];
		let t2 = t.screen[2];

		if ((t.coplanar & 1) == 0 && dist2(t0,t1) > 1)
			segments.push({ p0: t0, p1: t1 });
		if ((t.coplanar & 2) == 0 && dist2(t1,t2) > 1)
			segments.push({ p0: t1, p1: t2 });
		if ((t.coplanar & 4) == 0 && dist2(t2,t0) > 1)
			segments.push({ p0: t2, p1: t0 });

		let min_key_x = Math.trunc(t.min.x/key_scale);
		let min_key_y = Math.trunc(t.min.y/key_scale);
		let max_key_x = Math.trunc(t.max.x/key_scale);
		let max_key_y = Math.trunc(t.max.y/key_scale);

		for(let x=min_key_x ; x <= max_key_x ; x++)
		{
			for(let y=min_key_y ; y <= max_key_y ; y++)
			{
				let key = x + "," + y;
				if (screen_map[key])
					screen_map[key].push(t);
				else
					screen_map[key] = [t];
			}
		}
	}
}


function loadBytes(file, callback) {
  let oReq = new XMLHttpRequest();
  oReq.open("GET", file, true);
  oReq.responseType = "arraybuffer";
  oReq.onload = function(oEvent) {
    let arrayBuffer = oReq.response;
    if (arrayBuffer) {
      if (callback) {
        callback(new Uint8Array(arrayBuffer));
      }
    }
  }
  oReq.send(null);
}


function setup()
{
	//createCanvas(displayWidth, displayHeight); // WEBGL?
	createCanvas(1920, 1080); // WEBGL?
	background(255);

	loadBytes("test.stl", function(d){
		stl = parse_stl_binary(d);
		stl_map = stl_vertex(stl);
	 });

	eye = createVector(0,0,1000);
	lookat = createVector(0,0,0);
	up = createVector(0,1,0);
	fov = 80;
	x_offset = width/2;
	y_offset = height/2;
	camera = new Camera(eye,lookat,up,fov);
}


function v3_line(p0,p1)
{
	line(p0.x, -p0.y, p1.x, -p1.y);
/*
	push();
	strokeWeight(0.1);
	stroke(0,0,255,10);
	textSize(1.5);
	text(int(p0.z), p0.x, -p0.y);
	text(int(p1.z), p1.x, -p1.y);
	pop();
*/
}


function draw()
{
	if (!stl)
		return;

	if (mouseIsPressed)
	{
		camera.eye.x = mouseX - width/2;
		camera.eye.y = height/2 - mouseY;
		camera.update_matrix();

		redraw = true;
		done_hidden = 0;
		reproject = true;
	}

	if(reproject)
	{
		reproject = false;
		redraw = true;

		stl_reproject(stl);
	}

	// if there are segments left to process, continue to force redraw
	if (!redraw)
		return;

	background(255);

	push();
	translate(x_offset, y_offset);
	scale(z_scale);

	// draw an origin
	strokeWeight(0.1);
	stroke(0,0,255,40);
	line(0,0,0,20);
	line(0,0,10,0);

	// draw all of our in-processing segments lightly
	strokeWeight(0.1);
	stroke(255,0,0,20);
	for(s of segments)
		v3_line(s.p0, s.p1);

	// Draw all of our visible segments sharply
	strokeWeight(0.1);
	stroke(0,0,0,255);
	for(s of hidden_segments)
		v3_line(s.p0, s.p1);

	pop();

	if (mouseIsPressed)
	{
		// they are dragging; do not try to do any additional work
		return;
	}

	// if we haven't finished our coplanar analysis
	// attempt to find another few coplanar items
	if (done_coplanar < stl.length)
	{
		console.log("coplanar processing " + done_coplanar);
		redraw = true;
		reproject = true;

		if (stl_map)
		for(let i = 0 ; i < 4096 && done_coplanar < stl.length ; i++)
			stl[done_coplanar++].coplanar_update(stl_map)

	} else
	if (segments.length != 0)
	{
		// coplanar processing is done; find the hidden
		// line segments if they are not dragging
		console.log("hidden processing " + segments.length);
		redraw = true;

		for(let i = 0 ; i < 1024 && segments.length != 0 ; i++)
		{
			let s = segments.shift();
			let new_segments = hidden_wire(s, screen_map);
			hidden_segments = hidden_segments.concat(new_segments);
		}
	} else {
		redraw = false;
	}
}
