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
let done_coplanar;



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

	//httpGet("/test.stl", parse_stl_binary);
	loadBytes("/test.stl", function(d){ stl = parse_stl_binary(d) });

	eye = createVector(0,0,2000);
	lookat = createVector(0,0,0);
	up = createVector(0,1,0);
	fov = 80;
	x_offset = width/2;
	y_offset = height/2;
	camera = new Camera(eye,lookat,up,fov);
}


function v3_line(p0,p1)
{
	line(p0.x, p0.y, p1.x, p1.y);
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
	}

	if (!redraw)
		return;

	background(255);
	push();
	translate(x_offset, y_offset);
	scale(z_scale);

	stroke(0,0,0,100);
	strokeWeight(0.1);

	for(t of stl)
	{
		if (t.generation == camera.generation)
			continue;
		t.generation = camera.generation;
		t.project(camera);
	}

	for(t of stl)
	{
		if (t.invisible)
			continue;

		let t0 = t.screen[0];
		let t1 = t.screen[1];
		let t2 = t.screen[2];

		if ((t.coplanar & 1) == 0)
			v3_line(t0, t1);
		if ((t.coplanar & 2) == 0)
			v3_line(t1, t2);
		if ((t.coplanar & 4) == 0)
			v3_line(t2, t0);
	}

	pop();

	redraw = false;

	// if we haven't finished our coplanar analysis
	// attempt to find another few coplanar items
	if (done_coplanar < stl.length)
	{
		console.log("coplanar processing " + done_coplanar);
		for(let i = 0 ; i < 128 && done_coplanar < stl.length ; i++)
			stl[done_coplanar++].coplanar_update(stl)
		redraw = true;
	}
}
