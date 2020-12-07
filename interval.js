/*
 * 2D interval tree for sorting triangles.
 */

function Interval(x,y,scale)
{
	this.x = x;
	this.y = y;
	this.scale = scale;

	console.log("Interval("+x+","+y+","+scale+")");

	this.quads = [
		null,
		null,
		null,
		null,
	];

	this.span = [];

	this.quad_mask = function (min_x,min_y,max_x,max_y)
	{
		let q0 = (this.x < max_x && this.y < max_y) ? 0x01: 0x00;
		let q1 = (min_x < this.x && this.y < max_y) ? 0x02: 0x00;
		let q2 = (min_x < this.x && min_y < this.y) ? 0x04: 0x00;
		let q3 = (this.x < max_x && min_y < this.y) ? 0x08: 0x00;
		let span = ((min_x < this.x && this.x < max_x)
			|| (min_y < this.y && this.y < max_y)) ? 0x10 : 0x00;;

		return span | q0 | q1 | q2 | q3;
	};

	this.insert = function (t,min_x,min_y,max_x,max_y) {
		if (min_x > max_x || min_y > max_y)
			console.log(t);

		if (this.scale > 8)
		{
		let quads = this.quad_mask(min_x,min_y,max_x,max_y);
		//console.log(t, quads);

		for (let quad = 0 ; quad < 4 ; quad++)
		{
			if (quads != (1 << quad))
				continue;
			return this.quad(quad).insert(t,min_x,min_y,max_x,max_y);
		}
		}

		// multiple quadrants, put this in the span list
		this.span.push(t);
		return this;
	};

	this.quad = function (q) {
		if (this.quads[q])
			return this.quads[q];

		let ns = this.scale / 2;
		let nx = this.x + (q == 0 || q == 3 ? ns : -ns);
		let ny = this.y + (q == 0 || q == 1 ? ns : -ns);
		this.quads[q] = new Interval(nx,ny,ns);
		return this.quads[q];
	};

	this.query = function(min_x,min_y,max_x,max_y) {
		if (min_x > max_x || min_y > max_y)
			console.log("error:", min_x,min_y,max_x,max_y);

		let quads = this.quad_mask(min_x,min_y,max_x,max_y);
		let quad_list = [];

		for (let quad = 0 ; quad < 4 ; quad++)
		{
			if ((quads & (1 << quad)) == 0)
				continue;
			if (!this.quads[quad])
				continue;

			let new_list = this.quads[quad].query(min_x,min_y,max_x,max_y);
			quad_list = quad_list.concat(new_list);
		}

		// multiple quadrants? put this in the span list
		//if ((quads & 0x10) != 0)
			quad_list = quad_list.concat(this.span);

		//console.log("query:", this.x, this.y, min_x,min_y,max_x,max_y, quads, quad_list);
		return quad_list;
	};
};
