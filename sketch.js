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
let z_scale = 1;

stl = false;
let camera;
let redraw = false;
reproject = false;
let vx = 0;
let vy = 0;
let vz = 0;
let last_x = 0;
let last_y = 0;
let move_eye = false;

let camera_psi = 0;
let camera_theta = 0;
let camera_radius = 100;


function computeEye()
{
	camera.eye.x = camera_radius * Math.sin(camera_theta) * Math.sin(camera_psi);
	camera.eye.y = camera_radius * Math.cos(camera_theta);
	camera.eye.z = camera_radius * Math.sin(camera_theta) * Math.cos(camera_psi);
	camera.update_matrix();
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
	let canvas = createCanvas(windowWidth-10, windowHeight-30); // WEBGL?

	// Move the canvas so it’s inside our <div id="sketch-holder">.
	canvas.parent('sketch-holder');

	//createCanvas(1000, 1080); // WEBGL?
	background(255);

	loadBytes("test.stl", function(d){
		stl = new STL(d);
		reproject = true;
	});

	vx = vy = vz = 0;
	camera_theta = camera_psi = 0.01;
	camera_radius = 100;

	let eye = createVector(0,0,camera_radius);
	let lookat = createVector(0,0,0);
	let up = createVector(0,1,0);
	let fov = 80;
	x_offset = width/2;
	y_offset = height/2;
	camera = new Camera(eye,lookat,up,fov);

	computeEye();
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


function keyReleased()
{
	vx = vy = vz = 0;
	move_eye = false;
}

function keyPressed()
{
console.log(keyCode);
	if (keyCode == SHIFT)
		move_eye = true;

	if (keyCode == LEFT_ARROW)
		vx = -10;
	else
	if (keyCode == RIGHT_ARROW)
		vx = +10;

	if (keyCode == UP_ARROW)
		vz = -10;
	else
	if (keyCode == DOWN_ARROW)
		vz = +10;

	//return false;
}

function mousePressed()
{
	last_x = mouseX;
	last_y = mouseY;
}

function mouseWheel(event)
{
	vz = event.delta * 0.1;
}


function draw()
{
	if (!stl)
		return;

	if (mouseIsPressed && mouseY >= 0)
	{
		vx = mouseX - last_x;
		vy = mouseY - last_y;
		last_x = mouseX;
		last_y = mouseY;
	}
	if (vx != 0 || vy != 0 || vz != 0)
	{
		camera_radius += vz;

		if (move_eye)
		{
			// rotate the camera position in a circle around
			// the object
			camera.lookat.x += vx;
			camera.lookat.y += vy;
		} else {
			camera_psi += vx * 0.01;
			camera_theta += vy * 0.01;

			computeEye();

		}

		reproject = true;
		vx = 0;
		vy = 0;
		vz = 0;
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
	strokeWeight(1);
	stroke(255,0,0,20);
	for(s of stl.segments)
		v3_line(s.p0, s.p1);
	if (stl.segments.length != 0)
	{
		// draw an axis marker
		const origin = camera.project({x:0, y:0, z:0});
		const xaxis = camera.project({x:10, y:0, z:0});
		const yaxis = camera.project({x:0, y:10, z:0});
		const zaxis = camera.project({x:0, y:0, z:10});
		strokeWeight(10);
		stroke(255,0,0);
		if (xaxis) v3_line(origin, xaxis);
		stroke(0,255,0);
		if (yaxis) v3_line(origin, yaxis);
		stroke(0,0,255);
		if (zaxis) v3_line(origin, zaxis);
	}

	// Draw all of our visible segments sharply
	strokeWeight(0.5);
	stroke(0,0,0,255);
	for(s of stl.hidden_segments)
		v3_line(s.p0, s.p1);

	pop();

	// they are dragging; do not try to do any additional work
	if (!mouseIsPressed && !vx && !vy)
		redraw = stl.do_work(camera, 200);
}
