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
redblue_mode = false;

// blue color suggested by https://mastodon.sdf.org/@elb/105351977660915938
red_color = 0xff0000;
blue_color = 0x14ecfc;

verbose = false;

stl = false;
stl2 = false;
let camera;
let camera2; // for 3D
eye_separation = 2;
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

	if (camera_theta < 0)
		camera.up.z = -1;
	else
		camera.up.z = +1;

	camera.eye.add(camera.lookat);
	camera.update_matrix();

	// duplicate for 3D (lookat is shared)
	// should scale the eye separation based on the radius since
	// otherwise it becomes weird at long distances
	// in DARK mode, the eye glasses seem to be backwards?
	// normally left eye is red, right eye is blue, but
	// that messes up with a dark background.
	camera2.eye.x = camera_radius * Math.sin(camera_theta) * Math.sin(camera_psi + eye_separation * Math.PI / 180);
	camera2.eye.y = camera_radius * Math.sin(camera_theta) * Math.cos(camera_psi + eye_separation * Math.PI / 180);
	camera2.eye.z = camera_radius * Math.cos(camera_theta);

	// the lookat and up values are shared between the cameras
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
	let fov = 60;
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

function cameraView(theta,psi)
{
	camera_theta = theta * Math.PI / 180;
	camera_psi = psi * Math.PI / 180;
	computeEye();
	reproject = true;
}

function keyTyped()
{
	if (key === 'v')
	{
		verbose = !verbose;
		reproject = true;
	}

	if (key === '1')
		cameraView(90, 0);

	if (key === '2')
		cameraView(90, 90);

	if (key === '3')
		cameraView(90, 180);

	if (key === '4')
		cameraView(90, 270);

	if (key === '5')
		cameraView(1, 1);

	if (key === 't')
	{
		redblue_mode = !redblue_mode;
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
	vz = event.delta * 0.5;
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
		vx = (mouseX - last_x) * 0.5;
		vy = (mouseY - last_y) * 0.5;
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

	// if there are segments left to process, continue to force redraw
	if (!stl || !(redraw || reproject))
		return;

	redraw = false;

	if(reproject)
	{
		reproject = false;
		redraw = true;
		stl.project(camera);
		if (redblue_mode)
			stl2.project(camera2);
		start_time = performance.now();
		tri_per_sec = 0;
	}

	// they are dragging; do not try to do any additional work
	// and only compute the alterntate view if we're in 3D mode
	// if there was work done, return true to force another
	// pass through the draw loop.
	if (!mouseIsPressed)
	{
		if (redblue_mode)
			stl2.do_work(camera2, 200);

		stl.do_work(camera, 200);
	}

	if (dark_mode)
	{
		background(0);
		fill(9);
	} else {
		background(255);
		fill(253);
	}

	noStroke();
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
	if (redblue_mode)
		stroke(200,0,200,100);
	else
		stroke(0,200,0);
	for(let s of stl.segments)
		v3_line(s.p0, s.p1);

	if (verbose)
	{
		stroke(100,0,0,100);
		for(let s of stl.coplanar)
			v3_line(s.p0, s.p1);
	}

	if (stl.segments.length != 0 || (redblue_mode && stl2.segments.length != 0))
	{
		// if there are in process ones,
		// draw an XYZ axis at the lookat
		// and keep computing
		drawAxis(camera, camera.lookat);
		redraw = true;
	} else {
		// all done, this should be our last pass through
		// the draw loop
		redraw = false;
	}

	// Draw all of our visible segments sharply
	strokeWeight(1);
	if (dark_mode)
		stroke(255,255,255);
	else
		stroke(0,0,0);

	if (redblue_mode)
	{
		stroke(
			((blue_color) >> 16) & 0xFF,
			((blue_color) >>  8) & 0xFF,
			((blue_color) >>  0) & 0xFF,
			200
		);
		for(let s of stl2.visible_segments)
			v3_line(s.p0, s.p1);

		stroke(
			((red_color) >> 16) & 0xFF,
			((red_color) >>  8) & 0xFF,
			((red_color) >>  0) & 0xFF,
			80
		);
	}

	for(let s of stl.visible_segments)
		v3_line(s.p0, s.p1);

	pop();

}
