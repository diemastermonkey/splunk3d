/*
 * MODIFIED FOR SPLUNKLAND3D PROTOTYPE DEMO 04/2019
   3d.js : Chat-controlled block-based sandbox
   See themes/sandbox/*, cgi-bin/sandbox and mod_sandbox/*
   2017 @garyd @diemastermonkey
*/

// Setup / Globals
// -----------------------------------------
// var sExportCGI = "cgi-bin/3d-export";  // Ajax rec'v/store data
var sExportCGI = "cgi/3d-export";  // Ajax rec'v/store data
var iPrimLimit = 5000; // Not implemented: Prim limit
var iPrimCount = 0;
var iGlobalCycles = 0;   // Simple incr counter for 'time passes'
var oRootObject = null;
var aObjects = [];
var sObjectName = "default";   // Opt name on object create (x y z)
var sGroupName  = "default";   // Opt group name, for exporting etc
var sUserID     = null;   // Should phase-out 'object name'

// Retired: Own timer for Ajax command checks (reinstate?)
// var sServerMsg = "";            // ajax via controller.js
var sShoutoutName = "SplunkLand3D"; // Disused

// Camera and cam motion
// Retired // var fRotRateX = 0.008; var fRotRateY = 0.013;  // Disused
var fCamRange = 1600;   // Max distance from home
var fCamTime = 20000;   // Tween time ms larger is slower
var bCamFree = false;   // If false, looks at oLookAt
var fViewDistance = 9000; // Max clipping dist
// Where cam centered, starts from
var oCamHome = { x: 230, y: 555, z: -970};
var oCamPos = oCamHome;
var oCamGo = { x:0, y:0, z:0 };
var oCamNext = null;
// Where looking (also may wander)
var oLookHome = { x: 0, y: 0, z: 0 };
var oLookAt = oLookHome;
var fLookRange = 0.5;
var oNewLook = { x:0, y:0, z:0 };
// Tweens for cam and others
var oCamTween, oLookTween;

// Scene, Objects
var scene, renderer, camera, boxGeom, flatGeom;
var cube, boxMat, boxTex, boxTexOff, oLastModel;
var fPlaneOpacity = 0.70;
// retired spl3d // var oMoon, fMoonRotXDeg, fMoonRotYDeg;
var iBoxSize = 100;           // Size of standard 'voxel'

// Chat lobby
var iSphereFaces = 9; // Smaller performs better
var fLobbyHome = { x: 0, y: 0, z: -300 };

// Fonts and text stuff
var oGlobalFont;      // See fnLoadFont
// See also: helvetiker, optimer, gentilis, droid sans, droid serif
var oGlobalText = "SplunkLand3D", fontWeight = "bold";

// Lights
var oAmbientLight; // RETIRED , oCamLight;

// Random colors
var sRandColors = new Array (
  0xff0000, 0x00ff00, 0x0000ff, 0xffff00,
  0x00ffff, 0xff00ff, 0xffffff, 0x000000
);

// Seedable PRNG as object
// Webkit2's crazy invertible mapping generator
// var seed = 1234;
var fnRand = (function() {
  var max = Math.pow(2, 32), seed;
    return {
      setSeed : function(val) {
        seed = val || Math.round(Math.random() * max);
      },
      getSeed : function() { return seed; },
      random : function() {
        // creates randomness...somehow...
        seed += (seed * seed) | 5;
        // Shift off bits, discard sign. Discard is
        // important, OR w/ 5 can give us + or - numbers.
        return (seed >>> 32) / max;
      }
    };
}()); // End fnRand as object
  
// Setup (called on load in Mainline below!) 
function fnInit() {
  // Add event listener to resize renderer with browser
  window.addEventListener ('resize', function() {
    var WIDTH = window.innerWidth, HEIGHT = window.innerHeight;
    renderer.setSize(WIDTH, HEIGHT);
    // renderer.setClearColor (0x00ff00); // Green screen BG
    camera.aspect = WIDTH / HEIGHT;
    camera.updateProjectionMatrix();
  });  // End listener		  

}      // End function
    
// -----------------------------------------------
// Font functions mostly stolen from three.js
// To do: Move to dtv-fonts.js - see also assets/*.json
// Arg is FULL font file local url, ie
//  assets/droid_serif_regular.typeface.json
// -----------------------------------------------
     
// New! MakeText both loads font and handles mesh
// AND position, so it can be called from the page 
// Load font to global oGlobalFont, create argText mesh
// Args x, y, z are center position of text
function fnMakeText (argFontURL, argText, argX, argY, argZ) {
  var loader = new THREE.FontLoader();
	loader.load (
    argFontURL,
    function (response) {
	    oGlobalFont = response;
      // Create mesh only when ready
      fnCreateText (argText, argX, argY, argZ); // Fwd args
   	  }                   // End inner anon function
  );                    // End .load
}                       // End function

// Add text to scene (AFTER font loaded see fnLoadFont)
// To do: parameterize everything
// Function: Create text after font loaded (from threejs.org)
// To do: take args instead of globs
function fnCreateText (argText, argX, argY, argZ) {
  // Temporary local material, make settable later
  // MeshNormalMaterial
  // var tempMat = new THREE.MeshBasicMaterial({    // Hi perf
  // var tempMat = new THREE.MeshLambertMaterial({     // Prettier
  var tempMat = new THREE.MeshPhongMaterial({     // Prettier
      map: null, 
      // shading: THREE.FlatShading,
      // shading: THREE.SmoothShading,
      // wireframe: true,
      // wireframeLinewidth: 5.0,
      color: 0xffffff,
      specular: 0xffffff,
      shininess: 50,
      refractionRatio: 0
  });
  // Note textGeo is local only, no later reference!
  var textGeo = new THREE.TextGeometry (
    argText,             // Should be
    {
      font: oGlobalFont,
      size: 0.25,
      height: 0.05,            // Should be called 'depth'
      curveSegments: 3,       // Fewer is faster
      bevelEnabled: false,    // Bevel disabled
      material: tempMat, 
      extrudeMaterial: 0      // Q: wtf is this?
    }                         // End TextGeo props
  );	                    // End geometry 

  textGeo.computeBoundingBox();		// Superfluous?
  textGeo.computeVertexNormals();

  // Figure center of text
  var centerOffset = -0.5 * (
    textGeo.boundingBox.max.x - textGeo.boundingBox.min.x
  );
    
  // Create and add mesh (note local scope)
  var textMesh1 = new THREE.Mesh (textGeo, tempMat);
  textMesh1.position.x = argX + centerOffset;    // Center text
  textMesh1.position.y = argY;		
  textMesh1.position.z = argZ;
  textMesh1.rotation.x = 0;
  textMesh1.rotation.y = Math.PI * 2;	// Turn to face south
    
  // Add to (glob) scene
  fnLog ("3d: Text added to scene");
  scene.add (textMesh1);

} // End function fnCreateText

// Add sphere 
function fnAddSphere (argX, argY, argZ, argRadius, argTextureURL) {
  var tempTex, tempMat;

  // 20190416: Support "0xRRGGBB" (manual color) tex arg
  tempMat = new THREE.MeshBasicMaterial();
  if (! argTextureURL.startsWith("0x")) {
    tempTex = THREE.ImageUtils.loadTexture (argTextureURL);
    tempMat.map = tempTex;
  } else {                  // Blindly attempt as hex
    // tempMat.map = null;  // Must invalidate or applied below
    tempMat.color.setHex(parseInt(argTextureURL, 16)); // hex only
  }

  // OG // var tempTex = THREE.ImageUtils.loadTexture (argTextureURL);
  // OG // tempMat = new THREE.MeshBasicMaterial({map: tempTex});

  // Neither are working:
  // var tempMat = new THREE.MeshLambertMaterial({map: tempTex});
  // var tempMat = new THREE.MeshToonMaterial ({map:tempTex});
  var tempObj = new THREE.Mesh (
    new THREE.SphereGeometry (
      argRadius, iSphereFaces, iSphereFaces
    ), 
    tempMat
  );
  tempObj.position.y = argY; // Altitude
  tempObj.position.x = argX;
  tempObj.position.z = argZ;
  // ROTATION CURRENTLY RANDOM - fix that
  tempObj.rotation.y = - Math.PI / Math.random() * 2;        
  tempObj.rotation.z = - Math.PI / Math.random() * 2;        
  scene.add (tempObj); 
}

// fnAddPlane: Add square plane to scene with args
// Server syntax: 
//   plane x y z square_size x_rot_ratio y_rot_ratio texture_url
function fnAddPlane (argX, argY, argZ, argSize, 
  argXRot, argYRot, argTextureURL) {
  var tempObj = new THREE.Mesh (
    new THREE.PlaneGeometry (argSize, argSize),
      new THREE.MeshBasicMaterial ({		// Faster
      // new THREE.MeshLambertMaterial ({	// Responds to light
      map: new THREE.ImageUtils.loadTexture (argTextureURL),
      color: sRandColors[Math.round (Math.random() * 8)],
      // reflectivity: 0.9, 
      // lights: true,                      // Light affects (default)
      transparent: true,                 // For alpha ch
      doubleSided: true,                 // Doesn't seem to work
      opacity: fPlaneOpacity,            // Nice effect 
      wireframe: false,
      // shading: THREE.SmoothShading       // Default
      shading: THREE.FlatShading  // Faster
    })                          // End Mesh material
  );                            // End Mesh
  tempObj.doubleSided = true;   // No working
  // tempObj.receiveShadow = true; // Untested
  tempObj.position.y = argY; // Altitude
  tempObj.position.x = argX;
  tempObj.position.z = argZ;
  if (argYRot != 0) { tempObj.rotation.y = Math.PI * argYRot * 2; }
  if (argXRot != 0) { tempObj.rotation.x = Math.PI * argXRot * 2; }
  scene.add (tempObj); 
}

// Media cube test eventually should replace fnAddCube
// argTextureURL currently ignored
function fnMediaCube (argX, argY, argZ, argSize, argTextureURL) {
  // Create mesh/object, material returned from fnMaterial
  var tempObj = new THREE.Mesh (
    new THREE.BoxGeometry (argSize, argSize, argSize),
    fnMaterial ("media", "") 
  );
  tempObj.position.y = argY; // Altitude
  tempObj.position.x = argX;
  tempObj.position.z = argZ;
  tempObj.receiveShadow = true; // Default false
  tempObj.castShadow = true;

  // If a name is set, use that instead. Used elsewhere too.
  tempObj.name = sObjectName;  // May be x y z or 'cursor-username'
  if (! sObjectName.startsWith ("cursor-")) {   // Dont delete cursors
    fnPrimDelete (tempObj.position);            // Fail ignored
  }
  scene.add (tempObj); 

  // IMPORTANT: IMPLEMENT THIS! -v
  // Performance: If shape/pos/rot wont change, faster if:
  // tempObj.matrixAutoUpdate = false; // AFTER add!

  // DEV: Delete oldest prim if over limit (not working yet)
  // if (iPrimCount++ > iPrimLimit) { fnPrimLimit(); }

  // Return handle to object if caller wants
  return (tempObj);
}

// Add cube  (replace with 'mediaCube')
// Alternate materials:
// THREE.MeshBasicMaterial Fastest THREE.MeshLambertMaterial light response
// THREE.MeshStandardMaterial phong+lampbert THREE.MeshToonMaterial Broke?
// THREE.MeshPhongMaterial light response shiny
// Disused texture properties:
// emissive: 0xffffff,   // Lampbert only - light emission!
// emissiveIntensity: 0.5, // reflectivity: 0.25,
// specular: 0xffffff, // shininess: 0.5,
// shading: THREE.FlatShading  // Faster
function fnAddCube (argX, argY, argZ, argSize, argTextureURL) {
  var tempMat = new THREE.MeshPhongMaterial ({
    shading: THREE.FlatShading,   // Slower: THREE.SmoothShading,
    color: 0xffffff,              // Assume for textures sake
    transparent: true,
    doubleSided: false
  });
  
  // Load texture (replace with call to fnMaterial)
  // On load fail, try treating as '0xRRGGBB' hex, on color
  var tempTex = null;
  if (! argTextureURL.startsWith("0x")) {
    tempTex = THREE.ImageUtils.loadTexture (argTextureURL);
    if (tempTex) {
      tempMat.map = tempTex;   // Shorten w/above
    }
  } else {                 // Blindly attempt as hex
      tempMat.map = null;  // Must invalidate or applied below
      tempMat.color.setHex(parseInt(argTextureURL, 16)); // hex only
  }
  tempMat.update();    // 'dispatch update' - dox - reqd???

  // Create mesh/object
  var tempObj = new THREE.Mesh (
    new THREE.BoxGeometry (argSize, argSize, argSize),
    tempMat);
  tempObj.position.x = argX;
  tempObj.position.y = argY;
  tempObj.position.z = argZ;
  tempObj.receiveShadow = true; // Default false
  tempObj.castShadow = true;
  tempObj.doubleSided = false;        // Right place?
  // To do: Make rotation a parm?
  // tempObj.rotation.y = - Math.PI / Math.random() * 2;        
  // tempObj.rotation.z = - Math.PI / Math.random() * 2;        

  // 20170717: Pre-delete any existing prim at this position
  // ...NOT named 'cursor-'
  if (! sObjectName.startsWith ("cursor-")) {
    fnPrimDelete (tempObj.position);            // Fail ignored
  }

  // Set name to coords for pre-delete
  // To do: Replace with post-scene-add set for 'cursor'
  // No longer happens ever // if (sObjectName == null) 
  // If a name is set, use that instead. Used elsewhere too.
  // tempObj.name = sObjectName;  // May be x y z or 'cursor-username'
  // ^- Retired. object.name now only x y z. Owner handled by group.
  tempObj.name = argX + " " + argY + " " + argZ; // Used for pre-delete

  // Finally add object to scene
  scene.add (tempObj); 

  // New: Add to ("group-userid") group, creating if necessary 
  var oTempGroup = scene.getObjectByName(sGroupName);
  if (! oTempGroup) {
    fnLog ("3d: Group: Doesnt yet exist, creating " + sGroupName);
    oTempGroup = new THREE.Group();
    oTempGroup.name = sGroupName;
  }
  // Add to group
  tempObj.position = {x:0, y:0, z:0};  // switcheroo
  oTempGroup.add (tempObj);
  scene.add (oTempGroup);
  tempObj.position =  {x:argX, y:argY, z:argZ};

  // Performance: If shape/pos/rot wont change, faster if:
  // tempObj.matrixAutoUpdate = false; // AFTER add!

  // DEV: Delete oldest prim if over limit (not working yet)
  // if (iPrimCount++ > iPrimLimit) { fnPrimLimit(); }

  // Return handle to object if caller wants
  return (tempObj);
}

// Add a point light at arg position in arg color
function fnAddPointLight (argPos, argColor) {
  // Point light source
  var oTempLight = new THREE.PointLight (argColor, 1, 50);
  oTempLight.position.set (argPos);
  
  // Fancier point light
  /*
  var PI2 = Math.PI * 2;
  var program = function (context) {
    context.beginPath();
    context.arc( 0, 0, 0.5, 0, PI2, true );
    context.fill();
  };
  var sprite = new THREE.Sprite (
    new THREE.SpriteCanvasMaterial ({
      color: 0xff0040, program: program
    })
  );
  oTempLight.add (sprite);
  */

  // Visible object (to do: make luminous, retire light)
  var oObj = new THREE.Mesh (
    new THREE.SphereGeometry (133, iSphereFaces, iSphereFaces),
    new THREE.MeshLambertMaterial ({
      color: argColor,
      // map: oTex, 
      reflectivity: 0.25, 
      transparent: true,
      opacity: 0.5,
      shading: THREE.SmoothShading  // Alt: FlatShading
    })                              // End Mesh material
  );                                // End Mesh
  oObj.position.set (argPos);

  scene.add (oObj);
  // scene.add (oTempLight); // DISABLED FOR PERF
}

// Prune oldest object if over limit (not implemented)
function fnPrimLimit () {
  var deleteObj = (new Object3D()).getObjectById(1);
  var parentObj = deleteObj.parent;
  parentObj.remove (deleteObj);
}

// Delete prim by name (mostly dupes 'by argPos', fix that)
function fnDeleteByName (argName) {
  var deleteObj = scene.getObjectByName(argName);  // scene glob
  if (! deleteObj) {
    fnLog ("fnPrimDeleteByName: No match found for " + argName);
    return;
  }
  (deleteObj.parent).remove (deleteObj);
}

// Delete a prim by x y z position
// NOTE: Currently uses name field, change that
function fnPrimDelete (argPos) {
  var deleteObj = scene.getObjectByName (
    argPos.x + " " + argPos.y + " " + argPos.z
  );
  // Nope 
  // var deleteObj = scene.getObjectByProperty ("position", argPos);
  if (! deleteObj) {
    fnLog ("Delete: Info: No object at pos "
      + argPos.x + " " + argPos.y + " " + argPos.z 
    );
    return;
  }
  (deleteObj.parent).remove (deleteObj); // kludge/shorter
  fnLog ("Delete: Object deleted at "
      + argPos.x + " " + argPos.y + " " + argPos.z 
  );
}                 // End function

// Simple external setter for sObjectName for named objects
function fnObjectName (argName) {
  fnLog ("ObjectName: Set to " + argName);
  sObjectName = argName;
}

// Simple external setter for sGroupName for grouped objects
function fnGroupName (argName) {
  fnLog ("3d: GroupName: Set to " + argName);
  sGroupName = "group-" + argName;   // Global :(
}

// Move object by arg name to arg position
function fnObjectMove (argName, argX, argY, argZ) {
  // var tempObj = (new Object3D()).getObjectByName(argName); // ?
  var tempObj = scene.getObjectByName(argName);  // scene glob
  if (! tempObj) {
    fnLog ("fnObjectMove: No match found for " + argName);
    return;
  }
  tempObj.position.x = argX; tempObj.position.y = argY;
  tempObj.position.z = argZ;
  // tempObj.position = {x:argX, y:argY, z:argZ};
  fnLog ("fnObjectMove: " + argName + " moved.");
}

// Add a per-user 3d position cursor
// Move any prior instance, self-deletes after time
// Front end syntax: cursor
// Queue syntax: cursor x y z username (actually, userid used)
// Not kludged up in Y a bit to avoid overlap glitches
function fnUserCursor (argX, argY, argZ, argUserName) {

  // If no user cursor exist, create it 
  // (New) Cursor is a (group) box + THREE.axisHelper
  var oCursorTemp = scene.getObjectByName ("cursor-" + argUserName);
  if (! oCursorTemp) {
    // Note: Unfortunately, fnAddCube actually adds to scene
    // ...to do: abstract that to 'fnGenerateCube'
    sObjectName = "cursorbox-" + argUserName; // box name now disused?
    var oCursorBox =  fnAddCube (
      0, 0, 0, iBoxSize * 1.5,                // Max: Scaled @ render
      "users/" + argUserName + ".jpg");       // user pic cursor
    sObjectName = "default";                  // invalidate name

    // Callback 'pulsates' the avatar box via curve on cycles
    // ThreeJS Docs: .onBeforeRender
    // An optional callback that is executed immediately before the 
    // Object3D is rendered. Function called with these parameters: 
    //   renderer, scene, camera, geometry, material, group
    // this.rotation.y -= 0.03; // Also interesting
    // TO DO: Pre-calculate this $$$ curve, its unchanging
    // * -1 to invert negatives, making a 'bounce' vs S curve
    // Note: iGlobalCycles divisor should match/align to frameskip
    // this.id is used to salt clock
    oCursorBox.onBeforeRender = function (renderer, scene, camera,
      geometry, material, group) {
        // Only do this every (mod x) clicks ie 'frameskip'
        if (iGlobalCycles % 4 != 0) {return;}   // FYI wired frameskip
        var s = 0.3 + 0.75 * 
            (Math.abs(Math.sin ((this.id + iGlobalCycles) / 26)));
        this.scale.set(s, s, s);             // 3 args xyz
        // material.opacity = s * 1.0;         // Fade in with scale
    }                                        // End callback

    // To do: Add fx
    // oCursorTemp.material.emissive = 0xffffff;  // Lampbert material only
    // oCursorTemp.material.emissiveIntensity = 1;
    oCursorBox.material.transparent = true;
    oCursorBox.material.opacity = 0.5;      // Initial opacity
    oCursorBox.receiveShadow = false; oCursorBox.castShadow = false;

    // Add an axis helper object (to be joined to box by group)
    var oTempAxis = new THREE.AxisHelper (iBoxSize * 12); // Parm line len
    oTempAxis.scale.set (10, 10, 10);      // 3 args xyz
    var oCursorTemp = new THREE.Group(); // Group is derived from object3d
    oCursorTemp.name = "cursor-" + argUserName;   // For finding later
    oCursorTemp.position = {x:argX, y:argY, z:argZ};
    oCursorTemp.add (oTempAxis);
    oCursorTemp.add (oCursorBox);  // mb not legal?
    // Add group to scene despite children already being in scene :\
    scene.add (oCursorTemp); 

    fnLog ("User cursor created.");
  }

  // Cursor object exists - just move it
  oCursorTemp.position.x = argX;
  oCursorTemp.position.y = argY;
  oCursorTemp.position.z = argZ;
}                            // End function

// Initialize 3d 'chat lobby' w/user images
// Drops-out if sLobbyImageList unpopulated
function fnLobbyInit () {
  // sLobbyImageList via chatlobby.jsp via PanelServerRefresh
  if (sLobbyImageList) {
    var iCount = 0;     
    var aChatters = sLobbyImageList.split (" ");
    fnLog ("3d: Split sLobbyImageList (" + sLobbyImageList + ")");
  
    // Iterate chat user pics, generating objects for each
    aChatters.forEach(function(argItem, argIndex) {
      fnLog ("3d: Insert chatter " + argIndex + " / " + argItem);
      // MOVE to fnAddChatter - Note cludge to server path
      var oChatterTex = THREE.ImageUtils.loadTexture ("/" + argItem);
      var oChatterObj = new THREE.Mesh (
        new THREE.SphereGeometry (40, iSphereFaces, iSphereFaces),
        // new THREE.MeshBasicMaterial ({  // Simple, hi perf
        new THREE.MeshLambertMaterial ({
          map: oChatterTex, 
          reflectivity: 0, 
          transparent: true,
          opacity: 0.75,
          shading: THREE.SmoothShading  // Alt: FlatShading
        })                       // End Mesh material
      );                         // End Mesh
  
      // Line chatters up in a X-wide row, in Y-sized spacing
      // TO DO: Properly center
      oChatterObj.position.x = 
        fLobbyHome.x + 100 * iCount - 100 * 2;
      oChatterObj.position.y = fLobbyHome.y; // Just put in row 
      oChatterObj.position.z = fLobbyHome.z;
      // Rotate to face camera (broken)
      oChatterObj.rotation.y = - Math.PI * 0.5;
      scene.add (oChatterObj);   // Obj gets reused for each 
      iCount++;
    });                          // End foreach
  }                              // End if
}                                // End function

// Function: fnShoutout
// Adds, changes, removes 'shoutout' area
function fnShoutout (argImageURL) {
 // Currently using a flat plane
 var sTempTex = THREE.ImageUtils.loadTexture (argImageURL);
 // New: Hardwired text opacity 0.5
 var sTempMat = new THREE.MeshBasicMaterial({map: sTempTex, opacity: 0.5});
 var oTempObj = new THREE.Mesh (
   new THREE.PlaneGeometry (1, 1),
   sTempMat
 );
 oTempObj.position.y = 1.0;
 oTempObj.position.z = -2.9;  // JUST in front of back
 oTempObj.doubleSided = false;

 // For now, only adds
 scene.add (oTempObj); 
}

// Function: Generate/return a material per arguments
// To do: Convert 'fnAdd*' functions to use this
// Ex: fnMaterial ("basic", "0xff0000")
//     fnMaterial ("lampbert", "images/texture.png")
//     fnMaterial ("toon", "images/texture.png")
//     fnMaterial ("video", "doc_element_id")  // Video only
//     fnMaterial ("media", "doc_element_id")  // Ordinary images
//
function fnMaterial (argType, argData) {
  if (argType == "video") {
    // SAMPLE CODE ignores args 
    video = document.getElementById ('monitor');
    videoImage = document.getElementById('videoImage');
    videoImageContext = videoImage.getContext('2d');
    // background color if no video present
    // videoImageContext.fillStyle = '#000000';
    // videoImageContext.fillRect( 0, 0, videoImage.width, videoImage.height );
    videoTexture = new THREE.Texture( videoImage );
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    var movieMaterial = 
      new THREE.MeshBasicMaterial ({
        map: videoTexture, 
        overdraw: true, side:THREE.DoubleSide
    });
    return (movieMaterial);   // TEST: Return only movie materials
  }                           // End type video

  // Puts whatever's in the 'media' id image on the material
  // Arg ignored for now - later an option?
  if (argType == "media") {
    // tempURL = document.getElementById('media').src;
    // tempTexture = THREE.ImageUtils.loadTexture (tempURL);
    // tempTexture.needsUpdate = true;     // For updating, high cost!

    var video = document.getElementById('media');
    var tempTexture = new THREE.VideoTexture(video);
    tempTexture.minFilter = THREE.LinearFilter;   // Optional?
    tempTexture.magFilter = THREE.LinearFilter;
    tempTexture.format = THREE.RGBFormat;

    var tempMat = new THREE.MeshPhongMaterial ({
      map: tempTexture, 
      color: 0xffffff, 
      // transparent: true,
      shading: THREE.SmoothShading
      // emissive: 0xffffff,   // Lampbert only - light emission!
      // emissiveIntensity: 0.5, reflectivity: 0.25, shininess: 0.5
    });
    return (tempMat); 
  }                           // End if type media

  if (argType == "toon") {
    // var tempMat = new THREE.MeshToonMaterial ({    // Not working
    return;
  }
}                             // End function

// Render Function: Called on frame update
// -----------------------------------------------
function render () {
  requestAnimationFrame (render);     // Req frame update
  // Update wandering camera
  TWEEN.update();      // Q: Updates ALL tweens?

  // Retired // oSun.target = oMoon;               // Superfluous?
  // oSun.lookAt (oMoon.position);

  // New: Keep point light AND LapLight fixed to/at cam
  // oCamLight.position.set (oCamPos);
  // oLampLight.lookAt (oLookAt);
  // RETIRED // fnMoonOrbit();                 // New: Orbit moon

  renderer.render (scene, camera);  // Actually update scene
  iGlobalCycles++;  // Incr system ticker if wrap who cares
}

// Gather all objects named (arg) and submit them 
// to AjaxExporter (under argAsName)
function fnExportModel (argName, argAsName) {

  // Find named object 'group-argName' or fail
  var tmpGroup = scene.getObjectByName("group-" + argName);
  if (! tmpGroup) {
    fnLog ("3d: fnExport: No group found named group-" + argName);
    return;
  }

  // Kludge switcheroo the entire group as one object to world center
  // then back after export, so import can move it where it wants
  var tmpPos = tmpGroup.position;
  tmpGroup.position = {x:0, y:0, z:0};
  var tmpJSON = tmpGroup.toJSON();
  tmpGroup.position = tmpPos;  // Put back. Isnt there smarter way?

  // REQUIRES JQUERY: ajax request to:
  $.ajax({
    type: "POST",
    url: sExportCGI + "?" + argAsName, // Only cgi parm is name
    data: JSON.stringify(tmpJSON),
    contentType: "application/json",   // superfluous?
    dataType: "json",    // Docs: 'for response' ?! (not data)
    success: null,       // Callback on success, reqd but 'null ok'
    dataType: "text"     // Datatype expected BACK from server! Alt: html
  });

  //   Include error/success msg to screen
}                              // End function
    	  
// Import ThreeJS model to do: rename to fnImport :(
// Adds to scene on callback - tips:
// clara.io/learn/user-guide/data_exchange/threejs_export
// TO DO: ADD SEQ OR RND TO URL to ensure fresh copies?
// Note: That would also slow multiple loads. Make optional?
function fnLoadModel (argName, argX, argY, argZ) {
  var loader = new THREE.ObjectLoader();
  var oTmp = 
  loader.load ("mod_sandbox/models/" + argName + ".json", 
    function (obj) {
      obj.name = argName;
      obj.position.set (argX, argY, argZ);
      scene.add(obj);         // Add at cursor position
    }
  );
  // Kludge: Move the just-imported object to pos
  // To do: optional 'import as name', allows more options
  // oTmp.name = argName;     // Should not be necessary?
  // oTmp.position.set (argX, argY, argZ);  // error
  oTmp.updateMatrix();     // Must? Default off for perf
}                          // End function
     
// Disused: Texture animation tests
function fnTextureAnim() { 	
  // textureCanvas.offset.set(textureOffset += .001,0);
  boxTexOff += 0.01; oBoxTex.offset.set (boxTexOff, 0);
}

// Simply set next cam look target as arg pos
function fnCamSet (argX, argY, argZ) {
  oCamNext = {x:argX,y:argY,z:argZ};
  oLookAt = oCamNext;  // FIX
}

// Randomly set cam tween target pos ("cam -1200 200 100")
// (new) unless there's a pending 'cam next', then do that instead
// Called when prior cam tween finished, or ?
function fnCam (argPos) {
  // If next cam pos set (by user, etc) stay put and tween lookat
  if (oCamNext != null) { 
     // oLookAt = oCamNext;
     camera.lookAt (oCamNext);  // Kludge: Force look at now
     // oCamNext = null;
     // fnLookRand();     // Will handle pending look tween
     // return;
  }

  oCamGo.x = oCamHome.x + Math.random() * fCamRange - fCamRange / 2;
  oCamGo.y = oCamHome.y + Math.random() * fCamRange - fCamRange / 2;
  oCamGo.z = oCamHome.z + Math.random() * fCamRange - fCamRange / 2; 
  if (oLookAt.y < fCamRange / 2) {    // Force min is above look at
    oCamGo.y += oLookAt.y + 300;      // within reason
  }

  // Relaunch cam go tween. Dont reinstantiate it:
  oCamPos = camera.position;
  oCamTween = new TWEEN.Tween(oCamPos).to(oCamGo, fCamTime); 

  // Hook tween callback to position update
  oCamTween.onUpdate (function() {
    camera.position.x = oCamPos.x;
    camera.position.y = oCamPos.y;
    camera.position.z = oCamPos.z;
    camera.lookAt (oLookAt);  // Stick look at
  });
    
  // On tween finished, rand again
  // oTween.onComplete (function() { fnLookRand(); });
  oCamTween.onComplete (function() { fnCam(''); }); // Fck fnLookRand
  oCamTween.start();              // (Re) start tween
}

// Start a random tween of the lookat to a new position
function fnLookRand () {
  oNewLook.x = Math.random() * 2400 - 1200; 
    // fLookRange.x - fLookRange.x / 2;      // kludgefix
  oNewLook.y = Math.random() * 1800 - 900;
    // fLookRange.y - fLookRange.y / 4;
  oNewLook.z = Math.random() * 2400 - 1200;
    // fLookRange.z - fLookRange.z / 2;

  // If next cam pos set (by user, etc) use instead of rand
  if (oCamNext != null) { 
    // oNewLook = oCamNext;
    // camera.lookAt (oCamNext);
    // oCamNext = null;   // invalidate next
    // fnCam('');         // Switch to pos move instead
    // return;
  }

  // Instantiate/hook new look tween
  oLookTween = new TWEEN.Tween(oLookAt).to(oNewLook, fCamTime / 3); 
  oLookTween.onUpdate (function() { camera.lookAt (oLookAt); });
  oLookTween.onComplete (function() { fnCam(''); });
  oLookTween.start();              // (Re) start tween
}

// Add a point of light for each object in (arg) array, 
// its colors, etc based on the properties of the array element
// This is aSoundLights, generated by PanelServerRefresh but
// included serially on the web page (yech)
function fnSoundLights (aArgArray) {
  var light;
  if (!aArgArray) { return; }  // Silent fail empty arrays
  aArgArray.forEach (
    function (oSound, iIndex) {
      // Insert code to generate attributes via procgen
      // Use the SOUNDID as the prng seed
     
      // Visible object (to do: make luminous, retire light)
      var vTemp = {x:Math.random() * 100 - 50, y:0, z:0};
      var tColor = 16777225 % (oSound.file + 1);

      // Retired for perf - TO DO: replace with luminous material
      // fnAddPointLight (vTemp, tColor); 

    }   // End anon func in foreach
  );	// End foreach
}
    
// Kludge: Setter/getter for shoutout name
function fnSetShoutout (sArgName) {
  sShoutoutName = sArgName;
  fnLog ("3d-intro.js: sShoutoutName set to " + sArgName);
}

// Rotate ('orbit') moon
// retired: splunkland3d
/*
function fnMoonOrbit () {
  fMoonRotXDeg += 0.10;       // ie fixed day length
  fMoonRotYDeg += 0.03;
  if (fMoonRotXDeg > 180) { fMoonRotXDeg = 0; }
  if (fMoonRotYDeg > 180) { fMoonRotYDeg = 0; }
  // oMoon.rotateX(fMoonRotXDeg * Math.PI / 180);
  // oMoon.rotateY(fMoonRotYDeg * Math.PI / 180);
  // KLUDGE TEST
  if (fMoonRotYDeg > 1) { fMoonRotYDeg = 0; }
  oMoon.rotateY (fMoonRotYDeg);
}
*/

/* NEW Function: Return a simple skybox mesh
   Thanks to Lee Stemkoski for boilerplate - stemkoski.github.io
   Put images in mod_sandbox/images/skyboxes/prefix/prefix-dd.png
   Names object 'skybox' so fnSkybox can find/replace
   Note path is from server root
   Ex: scene.add (fnMakeSky());             // Default skybox
       scene.add (fnMakeSky("mp_portal"));  // path/file prefix
*/
function fnMakeSky (argPrefix) {
  fnLog ("3D: fnMakeSky argPrefix " + argPrefix);

  // Retire: Backward compatible old location
  var imagePrefix = "images/skyboxes/skyblue/skyblue_";

  if (argPrefix.length) {           // Optional new syntax
    imagePrefix = "images/skyboxes/" 
      + argPrefix + "/" + argPrefix + "_";  // in subdir same name
  }

  // New 'right left up down front back' scheme for skybox collection
  // NOTE: Disagrees with contributor ordering - FIX
  // OG // var directions  = ["rt", "lf", "up", "dn", "ft", "bk"];
  // var directions  = ["rt", "lf", "up", "dn", "ft", "bk"];
  // Modified, but still not right
  var directions  = ["lf", "rt", "up", "dn", "ft", "bk"];

  var imageSuffix = ".png";   // OG
  var fBounds = fViewDistance * 0.9;    // Just smaller than view
  var skyGeometry = new THREE.CubeGeometry (fBounds, fBounds, fBounds);
  // Run around the cube drawing the textures on the insides
  var materialArray = [];
  for (var i = 0; i < 6; i++) {
    materialArray.push( new THREE.MeshBasicMaterial ({
      map: THREE.ImageUtils.loadTexture (
        imagePrefix + directions[i] + imageSuffix),
      side: THREE.BackSide
    }));
  }

  var skyMaterial = new THREE.MeshFaceMaterial (materialArray);
  var skyBox = new THREE.Mesh (skyGeometry, skyMaterial);
  skyBox.name = "skybox";
  // Scoot skybox up so users Y 0 is near 'ground'
  // skyBox.position.y = fViewDistance/8;
  return (skyBox);
}

// Function: Make/replace skybox per args, and add to scene
//   fnSkybox ("prefix");
// ...uses mod_sandbox/images/skyboxes/prefix/prefix*
function fnSkybox (argPrefix) {
  // Pre-delete any existing skybox
  var deleteObj = scene.getObjectByName("skybox");
  if (! deleteObj) {
    fnLog ("Skybox: No pre-existing skybox yet");
  } else {
    (deleteObj.parent).remove (deleteObj);
    fnLog ("Skybox: Existing skybox deleted.");
  }

  scene.add (fnMakeSky(argPrefix)); // Warn: Glob scene obj
  fnLog ("3d: Skybox replaced with " + argPrefix);
}
 
// -----------------------------------------      
// Mainline
// -----------------------------------------      
fnInit();                     // Init ONLY resize listener
fnRand.setSeed (1518);        // New seedable prng 
    
// Set up 3d scene - note cam parm 0 is focal len
scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera (
  50, 
  window.innerWidth/window.innerHeight, 
  0.1, 
  fViewDistance
);
camera.lookAt (0, 0, 0);

// Default skybox (users can change, replacing 'skybox' object)
// Others: mp_portal hangingstone velcor alps mainframe nightsky classmplanet organic
fnSkybox("alps");

// Fog (see also renderer...) disabled for perf
// scene.fog = new THREE.Fog (0x000000, 1, 6000);
// scene.fog.color.setHSL (0.51, 0.4, 0.01);

// Add camera
// camera.position = new THREE.Vector3(-1000, -200, -2000);
camera.position.x = -900; 
camera.position.y = 700; 
camera.position.z = -1700; 
camera.lookAt (0, 0, 0);
camera.name = "camera";    // For addressing later
scene.add(camera);

// Ambient light source
oAmbientLight = new THREE.AmbientLight (0xffffff, 0.5);
// oAmbientLight.castShadow = true; // Does nothing?
scene.add (oAmbientLight);

// The sun, a directional light tracking orbiting target
// AND moon - to do: Use moon model instead
// RETIRED (splunkland3d)
/*
oMoon = new THREE.Mesh (
  new THREE.BoxGeometry (300, 300, 300),
  new THREE.MeshBasicMaterial ({color: 0x00ff00})
);
*/
// NOTE: May need to position, move, then rotate
// oMoon.position.y = -300; // Should be opposite sun
// oMoon.position.x = -900;
// oMoon.position.z = -900;
// oMoon.name = "moon";
// scene.add (oMoon);

// Sun
var oSun = new THREE.DirectionalLight (0xffff66, 0.8);
oSun.castShadow = true;
// New:
var SHADOW_MAP_WIDTH = 2048, SHADOW_MAP_HEIGHT = 1024;
oSun.shadow = 
  new THREE.LightShadow (
    new THREE.PerspectiveCamera (50, 1, 1500, 12000));
// oSun.shadow.bias = 0.0001;
oSun.shadow.mapSize.width = SHADOW_MAP_WIDTH;
oSun.shadow.mapSize.height = SHADOW_MAP_HEIGHT;
// ^- new
// oSun.target = oMoon; // retired splunkland3d
oSun.name = "sun";
scene.add (oSun);

// Disabled: On-camera light source ineffective?
// Note PointLight = no shadows?
// OG // oCamLight = new THREE.PointLight (0xffffff, 6, 8000);
// oCamLight = new THREE.SpotLight (0x0000ff); // , 1, 0, Math.PI/2);
// oCamLight.decay = 1000;  // Alt setter?
/* oCamLight.shadow = 
  new THREE.LightShadow (
    new THREE.PerspectiveCamera (50, 1, 1200, 2500));
// oCamLight.shadow.bias = 0.0001;
oCamLight.shadow.camera.near = 50;
oCamLight.shadow.camera.far = 9000;
oCamLight.shadow.camera.fov = 360;
oCamLight.castShadow = true;
oCamLight.position.set (camera.position);
scene.add (oCamLight); // disabled
*/

// Lamps 

// From side above 
// var oLampLight = new THREE.PointLight (0xffffff, 0.70, 25500);
// oLampLight.position.set (-3050, 4207, -3576);
// oLampLight.castShadow = true;
// oLampLight.lookAt (0,0,0);  // See also render 
// oLampLight.name = "lamp";
// scene.add (oLampLight);

// 'skylight' from above
var directionalLight = new THREE.DirectionalLight (0xffffff, 0.08);
directionalLight.castShadow = true;
scene.add (directionalLight);

// DISUSED
/* for (var i=0; i<4; i++) { var vTemp = {x:0, y:0, z:10 * i}; fnAddPointLight (vTemp, 0xffffff); } */

// New: Fancier point light
/*
var PI2 = Math.PI * 2;
var program = function (context) {
  context.beginPath();
  context.arc( 0, 0, 0.5, 0, PI2, true );
  context.fill();
};

var sprite = new THREE.Sprite (
  new THREE.SpriteCanvasMaterial( { color: 0xff0040, program: program })
);
oCam.add (sprite);
*/
      
// Set up render/page, add the scene to dom
renderer = new THREE.WebGLRenderer ({
  antialias: false,  // disable for perf
  alpha: true
});
renderer.setSize (window.innerWidth, window.innerHeight);
// Enable fog, shadows
// disabled for perf? // renderer.setClearColor (scene.fog.color);

// For shadows. See also THREE.PCFSoftShadowMap
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;

// Add Renderer to HTML document
// OG // document.body.appendChild (renderer.domElement);
// New: .REPLACE 'threejs' element, allow styling in body
var div = document.getElementById('threejs');
div.appendChild (renderer.domElement);
   
// RETIRED 'shoutout' command w/3d .intro theme 
// fnShoutout ("/requestor.jpg");

// Camera position/look tween
var oCamTween = new TWEEN.Tween(oCamPos).to(oCamGo, fCamTime);
var oLookTween = new TWEEN.Tween(oCamHome).to(oLookAt, fCamTime);

// fnLookRand();
fnCam('');             // Starts/restarts random tweens
render();              // Start/repeat render on clock

// fin
