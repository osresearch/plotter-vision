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
		stl = new STL(d);
		reproject = true;
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
		stl.project(camera);
	}

	// if there are segments left to process, continue to force redraw
	if (!stl || !redraw)
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
	for(s of stl.segments)
		v3_line(s.p0, s.p1);

	// Draw all of our visible segments sharply
	strokeWeight(0.1);
	stroke(0,0,0,255);
	for(s of stl.hidden_segments)
		v3_line(s.p0, s.p1);

	pop();

	// they are dragging; do not try to do any additional work
	if (!mouseIsPressed)
		redraw = stl.do_work(camera, 200);
}
