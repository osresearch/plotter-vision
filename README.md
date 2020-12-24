# Plotter Vision

This is a p5.js demo of hidden wire removal of 3D STL files
to generate SVG files that are suitable for plotting.
More info: [trmm.net/Plotter-Vision](https://trmm.net/Plotter-Vision/)

I'm not a javascript programmre, so this is probably not very well written.
Pull requests welcome!

Skull test
```
camera_psi=-1.41; camera_theta=1.29; camera_radius=376; camera.lookat=[-4,0,67]; vx=1; reproject=1
```

Stray line test with cube:
```
camera_psi=-2.657989999999999; camera_theta=1.22173; camera_radius=48.09999999999999; computeEye(); reproject=1
```

Triangle 63 is the issue

```
s = { p0: createVector(-32.93021870547144,45.28234346143727,47.01062411058749), p1: createVector(-8.758398115838349e-14,-4.3791990579191746e-14,47.34170854271354)}
t = stl.triangles.filter((x) => x.id == 63)
```

triangle screen coords:
0: d.Vector {p5: e, x: -204.56656832712974, y: -89.82438613518494, z: 37.38097386883177, name: "p5.Vector"}
1: d.Vector {p5: e, x: 123.78452747110691, y: -123.88600725605079, z: 45.53175754279287, name: "p5.Vector"}
2: d.Vector {p5: e, x: 18.541080776413278, y: 85.79892958328661, z: 40.94947454566327, name: "p5.Vector"}
