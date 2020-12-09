function v3new(x=0,y=0,z=0)
{
	return [x,y,z];
}

function v3copy(v)
{
	return [v[0], v[1], v[2]];
}

function v3min(v0,v1)
{
	return [
		Math.min(v0[0], v1[0]),
		Math.min(v0[1], v1[1]),
		Math.min(v0[2], v1[2]),
	];
}

function v3min3(out,v0,v1,v2)
{
	out[0] = Math.min(v0[0], v1[0], v2[0]);
	out[1] = Math.min(v0[1], v1[1], v2[1]);
	out[2] = Math.min(v0[2], v1[2], v2[2]);
	return out;
}

function v3max3(out,v0,v1,v2)
{
	out[0] = Math.max(v0[0], v1[0], v2[0]);
	out[1] = Math.max(v0[1], v1[1], v2[1]);
	out[2] = Math.max(v0[2], v1[2], v2[2]);
	return out;
}

function v3max(v0,v1)
{
	return [
		Math.max(v0[0], v1[0]),
		Math.max(v0[1], v1[1]),
		Math.max(v0[2], v1[2]),
	];
}

function v3sub(v0, v1)
{
	v0[0] -= v1[0];
	v0[1] -= v1[1];
	v0[2] -= v1[2];
	return v0;
}

function v3add(v0, v1)
{
	v0[0] += v1[0];
	v0[1] += v1[1];
	v0[2] += v1[2];
	return v0;
}

function v3mult(v, s)
{
	v[0] *= s;
	v[1] *= s;
	v[2] *= s;
	return v;
}

function close_enough(p0,p1)
{
	let eps = 0.0001;

	let dx = p0[0] - p1[0];
	if (dx < -eps || eps < dx)
		return false;

	let dy = p0[1] - p1[1];
	if (dy < -eps || eps < dy)
		return false;

	let dz = p0[2] - p1[2];
	if (dz < -eps || eps < dz)
		return false;

	return true;
}

function v3dot(a,b)
{
	return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

function v3cross(a,b)
{
	return [
	 	a[1]*b[2] - a[2] * b[1],
	 	a[2]*b[0] - a[0] * b[2],
		a[0]*b[1] - a[1] * b[0],
	];
}

function v3normalize(v)
{
	let inv_mag = 1.0 / Math.sqrt(v3dot(v,v));
	return v3mult(v, inv_mag);
}

function onscreen(p, w, h)
{
	if (p[0] < -w/2 || w/2 < p[0])
		return false;
	if (p[1] < -h/2 || h/2 < p[1])
		return false;
	return true;
}

