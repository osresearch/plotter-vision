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
	createCanvas(1024, 1024); // WEBGL?
	background(0);

	//httpGet("/test.stl", parse_stl_binary);
	loadBytes("/test.stl", function(d){ stl = parse_stl_binary(d) });

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
	line(p0.x, p0.y, p1.x, p1.y);
}


function draw()
{
	if (!stl)
		return;

  	if (mouseIsPressed) {
		background(0);
		camera.eye.x = mouseX - width/2;
		camera.eye.y = mouseY - height/2;
		camera.update_matrix();
	}

	push();
	translate(x_offset, y_offset);
	scale(z_scale);

	stroke(255);
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
}
