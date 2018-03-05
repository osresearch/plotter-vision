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
	console.log(raw_bytes);
	let bytes = new DataView(raw_bytes.buffer);

	console.log(raw_bytes[0]);
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

	loadBytes("/test1.stl", function(d){ stl = parse_stl_binary(d) });

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
	push();
	strokeWeight(0.1);
	stroke(0,0,255,10);
	textSize(1.5);
	text(int(p0.z), p0.x, -p0.y);
	text(int(p1.z), p1.x, -p1.y);
	pop();
}


function draw()
{
	if (!stl)
		return;

  	if (mouseIsPressed) {
		camera.eye.x = width/2 - mouseX;
		camera.eye.y = height/2 - mouseY;
		camera.update_matrix();
		redraw = true;
		done_hidden = 0;
		hidden_segments = [];
		segments = [];
		reproject = true;
	}

	// if there are segments left to process, continue to force redraw
	if (!redraw)
		return;

	background(255);
	push();
	translate(x_offset, y_offset);
	scale(z_scale);

	if(reproject)
	{
		reproject = false;

		for(t of stl)
		{
			if (t.generation == camera.generation)
				continue;
			t.generation = camera.generation;
			if (!t.project(camera))
				continue;

			// this one is on screen, create segments for each
			// of its non-coplanar edges
			let t0 = t.screen[0];
			let t1 = t.screen[1];
			let t2 = t.screen[2];

			if ((t.coplanar & 1) == 0)
				segments.push({ p0: t0, p1: t1 });
			if ((t.coplanar & 2) == 0)
				segments.push({ p0: t1, p1: t2 });
			if ((t.coplanar & 4) == 0)
				segments.push({ p0: t2, p1: t0 });
		}
	}

	// draw an origin
	strokeWeight(0.1);
	stroke(0,0,255,40);
	line(0,0,0,20);
	line(0,0,10,0);

	// draw all of our in-processing segments lightly
	strokeWeight(0.1);
	stroke(255,0,0,100);
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

		for(let i = 0 ; i < 128 && done_coplanar < stl.length ; i++)
			stl[done_coplanar++].coplanar_update(stl)

	} else
	if (segments.length != 0)
	{
		// coplanar processing is done; find the hidden
		// line segments if they are not dragging
		//console.log("hidden processing " + segments.length);
		redraw = true;

		for(let i = 0 ; i < 8 && segments.length != 0 ; i++)
		{
			let s = segments.shift();
			let new_segments = hidden_wire(s, stl, 0);
			console.log(new_segments.length + " new segments");
			hidden_segments = hidden_segments.concat(new_segments);
		}
	} else {
		redraw = false;
	}
}
