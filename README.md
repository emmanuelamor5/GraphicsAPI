Mini Software Rasterizer — Puzzle Game

Overview
This project is a small demonstration of a software graphics pipeline implemented with HTML5 Canvas, CSS and JavaScript. It includes a simple puzzle game where the player rotates two 3D objects and adjusts the light to match a target silhouette.

How the project maps to the graphics pipeline

- Application: scene setup, camera, object transforms and game logic are in `script.js` marked with `// [APPLICATION]` comments.
- Geometry: model transforms, normals, backface culling and projection are in `script.js` marked with `// [GEOMETRY]`.
- Rasterization: triangle rasterization, depth test and shading are implemented in `script.js` marked with `// [RASTERIZATION]`.

Files

- `index.html` — the HTML UI and controls.
- `style.css` — basic styling.
- `script.js` — the software rasterizer and game logic.

How to run
Open the project folder and open `index.html` in your browser. From PowerShell you can run:

```powershell
cd "c:\Users\emman\OneDrive\Documents\Graphics API\GraphicsAPI"
start index.html
```

Controls

- UI: Use the sliders to rotate the selected object and adjust the light.
- Keyboard: `1` select cube, `2` select pyramid; Arrow keys or `W`/`A`/`S`/`D` rotate the selected object; `Q`/`E` adjust light azimuth; `R` randomizes the scene.

Goal

Match the semi-transparent target silhouette shown at right by rotating objects and adjusting the light. Progress is shown as a percentage; reach ~97% to win.

Note
This project is intentionally minimal and educational; it implements basic 3D math and a triangle rasterizer in JavaScript to illustrate core pipeline stages.
