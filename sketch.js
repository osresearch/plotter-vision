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

function parse_xyz(bytes, offset)
{
	return {
		x: bytes.getFloat32(offset+0, 1),
		y: bytes.getFloat32(offset+4, 1),
		z: bytes.getFloat32(offset+8, 1),
	}
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
		let t;

		triangles.push([
			parse_xyz(bytes, offset + 12),
			parse_xyz(bytes, offset + 24),
			parse_xyz(bytes, offset + 32),
		]);
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
	//httpGet("/test.stl", parse_stl_binary);
	loadBytes("/test.stl", parse_stl_binary);
}

function draw()
{
/*
  if (mouseIsPressed) {
    fill(0);
  } else {
    fill(255);
  }
  ellipse(mouseX, mouseY, 80, 80);
*/
}
