/*
 * Parse ascii or binary STL file into a list of triangles
 * Binary Header (84 bytes):
 *   80 byte name
 *   uint32_t number of triangles
 *
 * Binary Triangle (50 bytes)
 *   3 32-bit float normals
 *   9 32-bit float x,y,z tripples
 *   uint16_t attributes (ignored)
 */

let x_offset;
let y_offset;
let z_scale = 1;
dark_mode = true;
verbose = false;

stl = false;
stl2 = false;
let camera;
let camera2; // for 3D
let eye_separation = 10;
redraw = false;
reproject = false;
let vx = 0;
let vy = 0;
let vz = 0;
let last_x = 0;
let last_y = 0;
let move_lookat = false;

let camera_psi = 0;
let camera_theta = 0;
let camera_radius = 100;

let start_time = 0;
let tri_per_sec = 0;

function computeEye()
{
	// normalize theta and psi
	if (camera_theta < -Math.PI)
		camera_theta += 2 * Math.PI;
	else
	if (camera_theta > +Math.PI)
		camera_theta -= 2 * Math.PI;

	if (camera_psi < -Math.PI)
		camera_psi += 2 * Math.PI;
	else
	if (camera_psi > +Math.PI)
		camera_psi -= 2 * Math.PI;

	camera.eye.x = camera_radius * Math.sin(camera_theta) * Math.sin(camera_psi);
	camera.eye.y = camera_radius * Math.sin(camera_theta) * Math.cos(camera_psi);
	camera.eye.z = camera_radius * Math.cos(camera_theta);

	// displace the camera2 eye by a little bit
	// for 3D effect.  The u vector points to the right of the camera
	// although there is a problem with up when we are close to theta
	camera2.eye.x = camera.eye.x + camera.u.x * eye_separation;
	camera2.eye.y = camera.eye.y + camera.u.y * eye_separation;
	camera2.eye.z = camera.eye.z + camera.u.z * eye_separation;

	if (camera_theta < 0)
		camera.up.z = -1;
	else
		camera.up.z = +1;

	camera.eye.add(camera.lookat);
	camera.update_matrix();

	// duplicate for 3D (lookat and up are shared)
	camera2.eye.add(camera.lookat);
	camera2.update_matrix();
}



function loadBytes(file, callback) {
  let oReq = new XMLHttpRequest();
  oReq.open("GET", file, true);
  oReq.responseType = "arraybuffer";
  oReq.onload = function(oEvent) {
    let arrayBuffer = oReq.response;
    if (arrayBuffer && callback) {
      callback(arrayBuffer);
    }
  }
  oReq.send(null);
}


function setup()
{
	let canvas = createCanvas(windowWidth-10, windowHeight-30); // WEBGL?
	x_offset = width/2;
	y_offset = height/2;

	// Move the canvas so it’s inside our <div id="sketch-holder">.
	canvas.parent('sketch-holder');

	//createCanvas(1000, 1080); // WEBGL?
	background(0);

	loadBytes("test.stl", function(d){
		stl = new STL(d);
		stl2 = new STL(d);
		reproject = true;
	});

	// initial viewport
	vx = vy = vz = 0;
	camera_theta = 70 * Math.PI / 180;
	camera_psi = -150 * Math.PI / 180;
	camera_radius = 170;

	let eye = createVector(0,camera_radius,0);
	let eye2 = createVector(0,camera_radius,0);
	let lookat = createVector(0,0,00);
	let up = createVector(0,0,1);
	let fov = 80;
	camera = new Camera(eye,lookat,up,fov);
	camera2 = new Camera(eye2,lookat,up,fov);

	computeEye();
}


function v3_line(p0,p1)
{
	if (verbose)
	{
		push()
		color(255,255,255,40);
		stroke(0.1);
		text(p0.z.toFixed(2), p0.x, -p0.y);
		text(p1.z.toFixed(2), p1.x, -p1.y);
		pop();
	}

	line(p0.x, -p0.y, p1.x, -p1.y);
}


function drawAxis(camera, lookat)
{
	// draw an axis marker at the look-at point
	const origin = camera.project(lookat)
	const xaxis = camera.project(new p5.Vector(5,0,0).add(lookat));
	const yaxis = camera.project(new p5.Vector(0,5,0).add(lookat));
	const zaxis = camera.project(new p5.Vector(0,0,5).add(lookat));
	strokeWeight(5);

	if (!xaxis || !yaxis || !zaxis)
	{
		// draw them anyway, since no good ordering is possible
		stroke(255,0,0);
		if (xaxis) v3_line(origin, xaxis);
		stroke(0,255,0);
		if (yaxis) v3_line(origin, yaxis);
		stroke(0,0,255);
		if (zaxis) v3_line(origin, zaxis);
		return;
	}

	// draw the axis lines in back-to-front order
	const xd = xaxis.z;
	const yd = yaxis.z;
	const zd = zaxis.z;
	if (xd > yd && yd > zd)
	{
		stroke(255,0,0); v3_line(origin, xaxis);
		stroke(0,255,0); v3_line(origin, yaxis);
		stroke(0,0,255); v3_line(origin, zaxis);
	} else
	if (xd > zd && zd > yd)
	{
		stroke(255,0,0); v3_line(origin, xaxis);
		stroke(0,0,255); v3_line(origin, zaxis);
		stroke(0,255,0); v3_line(origin, yaxis);
	} else
	if (yd > xd && xd > zd)
	{
		stroke(0,255,0); v3_line(origin, yaxis);
		stroke(255,0,0); v3_line(origin, xaxis);
		stroke(0,0,255); v3_line(origin, zaxis);
	} else
	if (yd > zd && zd > xd)
	{
		stroke(0,255,0); v3_line(origin, yaxis);
		stroke(0,0,255); v3_line(origin, zaxis);
		stroke(255,0,0); v3_line(origin, xaxis);
	} else
	if (zd > xd && xd > yd)
	{
		stroke(0,0,255); v3_line(origin, zaxis);
		stroke(255,0,0); v3_line(origin, xaxis);
		stroke(0,255,0); v3_line(origin, yaxis);
	} else
	if (zd > yd && yd > xd)
	{
		stroke(0,0,255); v3_line(origin, zaxis);
		stroke(0,255,0); v3_line(origin, yaxis);
		stroke(255,0,0); v3_line(origin, xaxis);
	} else {
		// wtf how did we end up here?
	}
}

function keyReleased()
{
	vx = vy = vz = 0;
	move_lookat = false;
}

function keyPressed()
{
console.log(keyCode);
	if (keyCode == SHIFT)
		move_lookat = true;

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

function keyTyped()
{
	if (key === 'v')
	{
		verbose = !verbose;
		reproject = true;
	}
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
 
function windowResized() {
	resizeCanvas(windowWidth-10, windowHeight-30);
	camera.width = width;
	camera.height = height;
	x_offset = width/2;
	y_offset = height/2;
	reproject = true;
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
		if (camera_radius <= 0)
			camera_radius = 1;

		if (move_lookat)
		{
			camera.lookat.x += vx;
			camera.lookat.z += vy;
		} else {
			camera_psi += vx * 0.01;
			camera_theta -= vy * 0.01;

		}

		computeEye();
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
		stl2.project(camera2);
		start_time = performance.now();
		tri_per_sec = 0;
	}

	// if there are segments left to process, continue to force redraw
	if (!stl || !redraw)
		return;

	noStroke();

	if (dark_mode)
	{
		background(0);
		fill(9);
	} else {
		background(255);
		fill(253);
	}

	textSize(128);
	textAlign(RIGHT, BOTTOM);
	text("plotter.vision", width, height);

	fill(dark_mode ? 150 : 80);
	textSize(12);
	textAlign(LEFT, BOTTOM);

	text("camera " + int(camera.eye.x) + "," + int(camera.eye.y) + "," + int(camera.eye.z), 10, 30);
	text("lookat " + int(camera.lookat.x) + "," + int(camera.lookat.y) + "," + int(camera.lookat.z), 10, 50);

	text("theta " + int(camera_theta * 180 / Math.PI), 10, 100);
	text("  psi " + int(camera_psi * 180 / Math.PI), 10, 120);
	text("    r " + int(camera_radius), 10, 140);

	if (stl.segments.length == 0)
	{
		if (tri_per_sec == 0)
			tri_per_sec = int(stl.triangles.length * 1000 / (performance.now() - start_time));
		text("tri/s " + tri_per_sec, 10, 180);
	}

	push();
	translate(x_offset, y_offset);
	scale(z_scale);

	// draw all of our in-processing segments lightly
	strokeWeight(1);
	stroke(0,200,0);
	for(let s of stl.segments)
		v3_line(s.p0, s.p1);

	if (verbose)
	{
		stroke(100,0,0,100);
		for(let s of stl.coplanar)
			v3_line(s.p0, s.p1);
	}

	// if there are in process ones, draw an XYZ axis at the lookat
	if (stl.segments.length != 0)
		drawAxis(camera, camera.lookat);

	// Draw all of our visible segments sharply
	strokeWeight(0.5);
	if (dark_mode)
		stroke(255,255,255);
	else
		stroke(0,0,0);

	stroke(255,0,0);
	for(let s of stl.visible_segments)
		v3_line(s.p0, s.p1);

	stroke(0,0,255);
	for(let s of stl2.visible_segments)
		v3_line(s.p0, s.p1);

	pop();

	// they are dragging; do not try to do any additional work
	if (!mouseIsPressed && !vx && !vy)
	{
		stl2.do_work(camera2, 200);
		redraw = stl.do_work(camera, 200);
	}
}
