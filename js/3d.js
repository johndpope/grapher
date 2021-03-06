var Detector = require('three/examples/js/Detector.js');
var WindowResize = require('exports?THREEx.WindowResize!./vendor/THREEx.WindowResize.js');

var CustomArrow = require('./CustomArrow.js');

var _3D = exports._3D = {};

_3D.Main = {
    container:  undefined,
    scene:      undefined,
    camera:     undefined,
    renderer:   undefined,
    controls:   undefined,
    surfaces:   undefined,
    traceActive: false,
    boxLines: undefined,
    grid: undefined
};

var container, scene, camera, renderer, controls;

_3D.MiniAxes = {
    container:  undefined,
    scene:      undefined,
    renderer:   undefined,
    camera:     undefined
};

//var axesContainer, axesScene, axesRenderer, axesAxisHelper, axesCamera;

// parameters for the equations
var a = 0.01, b = 0.01, c = 0.01, d = 0.01;
var meshFunction;
var segments = 100,
    xMin = -10, xMax = 10, xRange = xMax - xMin,
    yMin = -10, yMax = 10, yRange = yMax - yMin,
    zMin = -10, zMax = 10, zRange = zMax - zMin;

var graphGeometry;
var gridMaterial, wireMaterial, vertexColorMaterial;
var graphMesh;
init();
animate();

function dimensionCallback() {
    return {
        width: $('#ThreeJS').width(),
        height: $('#ThreeJS').height()
    }
}

function createLine(x0, y0, z0, x1, y1, z1, mat) {
    var geo = new THREE.Geometry();
    geo.vertices.push(new THREE.Vector3(x0, y0, z0));
    geo.vertices.push(new THREE.Vector3(x1, y1, z1));

    return new THREE.Line(geo, mat);
}

// FUNCTIONS
function init() {
    // SCENE
    _3D.Main.scene = new THREE.Scene();
    var scene = _3D.Main.scene;
    // CAMERA
    var SCREEN_WIDTH = $('#ThreeJS').width(), SCREEN_HEIGHT = $('#ThreeJS').height();

    var VIEW_ANGLE = 45,
        ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT,
        NEAR = 0.1,
        FAR = 20000;

    _3D.Main.camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
    var camera = _3D.Main.camera;

    scene.add(camera);
    camera.up = new THREE.Vector3(0, 0, 1);
    camera.position.set(0, 10, 5);
    camera.lookAt(scene.position);
    // RENDERER
    if (Detector.webgl)
        _3D.Main.renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
    else
        _3D.Main.renderer = new THREE.CanvasRenderer({alpha:true});
    var renderer = _3D.Main.renderer;

    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);

    _3D.Main.container = document.getElementById( 'ThreeJS' );
    var container = _3D.Main.container;
    container.appendChild(renderer.domElement);
    // EVENTS
    WindowResize(renderer, camera, dimensionCallback);
    // CONTROLS

    _3D.Main.controls = new THREE.OrbitControls( camera, renderer.domElement );
    var controls = _3D.Main.controls;
    controls.minDistance = 0.5;
    controls.maxDistance = 100;
    controls.zoomSpeed = 0.5; // 1 by default
    controls.enableKeys = false;

    // LIGHT
    var light = new THREE.PointLight(0xffffff);
    light.position.set(0,0,250);
    scene.add(light);

    var ambient = new THREE.AmbientLight( 0xFFFFFF );
    scene.add(ambient);
    // SKYBOX/FOG
    // scene.fog = new THREE.FogExp2( 0x888888, 0.00025 );

    var gridObj = new THREE.Object3D();
    var lineMat = new THREE.LineBasicMaterial({color: 0x000088});
    for (var i = -5; i <= 5; i++) {
        var line = createLine(i, -5, 0, i, 5, 0, lineMat);
        gridObj.add(line);

        var line = createLine(-5, i, 0, 5, i, 0, lineMat);
        gridObj.add(line);
    }
    scene.add(gridObj);
    _3D.Main.grid = gridObj;


    function cube( size ) {
        var h = size * 0.5;
        var geometry = new THREE.Geometry();
        geometry.vertices.push(
            new THREE.Vector3( -h, -h, -h ),
            new THREE.Vector3( -h, h, -h ),
            new THREE.Vector3( -h, h, -h ),
            new THREE.Vector3( h, h, -h ),
            new THREE.Vector3( h, h, -h ),
            new THREE.Vector3( h, -h, -h ),
            new THREE.Vector3( h, -h, -h ),
            new THREE.Vector3( -h, -h, -h ),
            new THREE.Vector3( -h, -h, h ),
            new THREE.Vector3( -h, h, h ),
            new THREE.Vector3( -h, h, h ),
            new THREE.Vector3( h, h, h ),
            new THREE.Vector3( h, h, h ),
            new THREE.Vector3( h, -h, h ),
            new THREE.Vector3( h, -h, h ),
            new THREE.Vector3( -h, -h, h ),
            new THREE.Vector3( -h, -h, -h ),
            new THREE.Vector3( -h, -h, h ),
            new THREE.Vector3( -h, h, -h ),
            new THREE.Vector3( -h, h, h ),
            new THREE.Vector3( h, h, -h ),
            new THREE.Vector3( h, h, h ),
            new THREE.Vector3( h, -h, -h ),
            new THREE.Vector3( h, -h, h )
         );
        return geometry;
    }

    var geometryCube = cube( 6 );
    geometryCube.computeLineDistances();
    var object = new THREE.LineSegments(
            geometryCube,
            new THREE.LineDashedMaterial({color: 0x1111AA, dashSize: 0.2, gapSize: 0.1, linewidth: 1})
    );
    _3D.Main.boxLines = object;
    scene.add(object);

    ////////////
    // CUSTOM //
    ////////////

    //scene.add( new THREE.AxisHelper() );
    // wireframe for xy-plane
    var wireframeMaterial = new THREE.MeshBasicMaterial( { color: 0x000088, wireframe: true, side:THREE.DoubleSide } );
    var floorGeometry = new THREE.PlaneGeometry(10,10,10,10);

    var normMaterial = new THREE.MeshNormalMaterial;
    var shadeMaterial = new THREE.MeshLambertMaterial( { color: 0xff0000 } );

    // "wireframe texture"
    var wireTexture = new THREE.ImageUtils.loadTexture( 'assets/images/square.png' );
    wireTexture.wrapS = wireTexture.wrapT = THREE.RepeatWrapping;
    wireTexture.repeat.set( 40, 40 );
    wireMaterial = new THREE.MeshBasicMaterial( { map: wireTexture, vertexColors: THREE.VertexColors, side:THREE.DoubleSide } );
    var vertexColorMaterial  = new THREE.MeshBasicMaterial( { vertexColors: THREE.VertexColors } );
    // bgcolor
    //renderer.setClearColor( 0x888888, 1 );

    _3D.Main.raycaster = new THREE.Raycaster();
    _3D.Main.mousePos = new THREE.Vector2();
    // Mouse interactivity
    $('#ThreeJS').mousemove(function(e) {
        var ele = container.parentNode;
        var mousePos = _3D.Main.mousePos;
        mousePos.x = e.clientX - ele.offsetLeft;
        mousePos.x = (mousePos.x / ele.clientWidth) * 2 - 1;
        mousePos.y = e.clientY - container.parentNode.offsetTop;
        mousePos.y = -((mousePos.y / ele.clientHeight) * 2 - 1);
    })

    var redMat = new THREE.MeshBasicMaterial({color: 0xFF0000});
    var traceSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 20, 20),
        new THREE.MeshBasicMaterial({color: 0xFF0000})
    );
    var traceSphere = new THREE.Object3D();
    traceSphere.add(new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 20, 20),
        redMat
    ));

    _3D.Main.traceSphere = traceSphere;
    traceSphere.visible = false;
    scene.add(traceSphere);

    var surfaces = new THREE.Object3D();
    _3D.Main.surfaces = surfaces;
    surfaces.up = new THREE.Vector3(0, 0, 1);
    scene.add(surfaces);


    createAxesWindow();
}

function createAxesWindow() {
    var axesContainer = document.getElementById('ThreeJS-axes');
    _3D.MiniAxes.container = axesContainer;

    var containerWidth = $(axesContainer).width();
    var containerHeight = $(axesContainer).height();

    if (Detector.webgl)
        var axesRenderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
    else
        var axesRenderer = new THREE.CanvasRenderer({alpha:true});
    _3D.MiniAxes.renderer = axesRenderer;
    //axesRenderer.setClearColor(0xEEEEEE, 1);
    axesRenderer.setSize(containerWidth, containerHeight);
    axesRenderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);

    axesContainer.appendChild(axesRenderer.domElement);

    var axesScene = new THREE.Scene();
    _3D.MiniAxes.scene = axesScene;

    var axesCamera = new THREE.PerspectiveCamera(50, containerWidth/containerHeight, 1, 1000);
    _3D.MiniAxes.camera = axesCamera;
    axesCamera.up = _3D.Main.camera.up;

    //axesAxisHelper = new THREE.AxisHelper(100);
    //axesScene.add(axesAxisHelper);
    var xAxis = new CustomArrow(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, 0),
        100, 0xFF0000, undefined, 10
    );
    var yAxis = new CustomArrow(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 0),
        100, 0x00FF00, undefined, 10
    );
    var zAxis = new CustomArrow(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, 0),
        100, 0x0000FF, undefined, 10
    );
    axesScene.add(xAxis);
    axesScene.add(yAxis);
    axesScene.add(zAxis);
}

function raycastMouse() {
    var mousePos = _3D.Main.mousePos;
    var camera = _3D.Main.camera;
    var traceSphere = _3D.Main.traceSphere;

    var vector = new THREE.Vector3(mousePos.x, mousePos.y, 1);
    vector.unproject(camera);

    var ray = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());

    // recursive
    var intersects = ray.intersectObjects(_3D.Main.surfaces.children, true);
    var ele = document.getElementById('trace-info-container');
    if (intersects.length > 0) {
        traceSphere.visible = true;
        traceSphere.position.copy(intersects[0].point);


        var pt = intersects[0].point;
        var x = pt.x.toFixed(3),
            y = pt.y.toFixed(3),
            z = pt.z.toFixed(3);

        ele.innerText = 'Trace: (' + x + ', ' + y + ', ' + z + ')';
    } else {
        traceSphere.visible = false;
        ele.innerText = 'Trace: None'
    }
}

function animate() {
    requestAnimationFrame(animate);
    render();
    update();
}

function update() {
    _3D.Main.controls.update();

    var axesCamera = _3D.MiniAxes.camera;
    axesCamera.position.copy(_3D.Main.camera.position);
    axesCamera.position.sub(_3D.Main.controls.target);
    axesCamera.position.setLength(300);
    axesCamera.lookAt(_3D.MiniAxes.scene.position);

    if (_3D.Main.traceActive) {
        raycastMouse();
    }
}

function render() {
    _3D.Main.renderer.render(_3D.Main.scene, _3D.Main.camera);
    _3D.MiniAxes.renderer.render(_3D.MiniAxes.scene, _3D.MiniAxes.camera);
}

_3D.Main.clearSurfaces = function() {
    var arr = _3D.Main.surfaces.children;
    for (var i = arr.length - 1; i >= 0; i--) {
        var o = arr[i];
        if (o.material)
            o.material.dispose();
        if (o.geometry)
            o.geometry.dispose();
        _3D.Main.surfaces.remove(o);
    }
    console.log(_3D.Main.surfaces.children.length);
}

_3D.Main.addSurface = function(surf) {
    _3D.Main.surfaces.add(surf);
}

_3D.ParametricCurve = THREE.Curve.create(
    function(xfunc, yfunc, zfunc, domainMin, domainMax) {
        this.xfunc = xfunc;
        this.yfunc = yfunc;
        this.zfunc = zfunc;
        this.domainMin = domainMin;
        this.domainMax = domainMax;
    },
    function(t) {
        // remap t from [0, 1] to [domainMin, domainMax]
        var t = this.domainMin + (this.domainMax - this.domainMin)*t;

        var x = this.xfunc(t),
            y = this.yfunc(t),
            z = this.zfunc(t);
        return new THREE.Vector3
    }
);
