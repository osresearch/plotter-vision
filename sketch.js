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

let stl = false;
let camera;
let redraw = false;
let reproject = false;
let vx = 0;
let vy = 0;




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
	createCanvas(windowWidth-10, windowHeight-10); // WEBGL?
	//createCanvas(1000, 1080); // WEBGL?
	background(255);

	loadBytes("test.stl", function(d){
		stl = new STL(d);
		reproject = true;
	});

	let eye = createVector(0,0,100);
	let lookat = createVector(0,0,0);
	let up = createVector(0,1,0);
	let fov = 80;
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


function keyReleased()
{
	vx = vy = 0;
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
		vy = +10;
	else
	if (keyCode == DOWN_ARROW)
		vy = -10;

	//return false;
}


function draw()
{
	if (!stl)
		return;

	if (mouseIsPressed)
	{
		if (move_eye)
		{
			camera.eye.x = mouseX - width/2;
			camera.eye.y = height/2 - mouseY;
		} else {
			camera.lookat.x = mouseX - width/2;
			camera.lookat.y = height/2 - mouseY;
		}

		reproject = true;
	}
	if (vx != 0 || vy != 0)
	{
		if (move_eye)
		{
			camera.eye.x += vx;
			camera.eye.y += vy;
		} else {
			camera.lookat.x += vx;
			camera.lookat.y += vy;
		}
		reproject = true;
	}


	if(reproject)
	{
		reproject = false;
		camera.update_matrix();
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
