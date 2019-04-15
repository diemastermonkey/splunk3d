/* Function: Return a simple skybox mesh
   Thanks to Lee Stemkoski for boilerplate - stemkoski.github.io
   Put images in mod_sandbox/images/skybox-xxxx.png
   Ex:
     scene.add (fnMakeSky());
*/

// import "panels/three.min.js";
// import "/panels/GeometryUtils.js"

function fnMakeSky () {

  var imagePrefix = "/mod_sandbox/images/skybox-";
  var directions  = ["xpos", "xneg", "ypos", "yneg", "zpos", "zneg"];
  var imageSuffix = ".png";
  // var skyGeometry = new THREE.CubeGeometry (5000, 5000, 5000);
  var skyGeometry = new THREE.CubeGeometry (1000, 1000, 1000);
  var materialArray = [];

  for (var i = 0; i < 6; i++) {
	  materialArray.push( new THREE.MeshBasicMaterial ({
		  map: THREE.ImageUtils.loadTexture (imagePrefix + directions[i] + imageSuffix),
		  side: THREE.BackSide
		}));
  }

	var skyMaterial = new THREE.MeshFaceMaterial (materialArray);
	var skyBox = new THREE.Mesh (skyGeometry, skyMaterial);

	// scene.add (skyBox);
  return (skyBox);
}

