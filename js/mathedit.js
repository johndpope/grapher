var Grapher = require('./3d.js');
var math = require('mathjs');
var CustomArrow = require('./CustomArrow.js');
var WorkerUtil = require('./util/workerutil.js');
var StringUtil = require('./util/stringutil.js');
var exprContainsSymbol = require('./util/mathutil.js').exprContainsSymbol;

var workerContent = require('raw-loader!./3dworker.js');
var worker1 = WorkerUtil.createWorker(workerContent);
var worker2 = WorkerUtil.createWorker(workerContent);
var worker3 = WorkerUtil.createWorker(workerContent);
var worker4 = WorkerUtil.createWorker(workerContent);

var handleMessage = function(m) {
    var data = m.data;
    if (data.action == 'iso_done') {
        $('.progress-bar').css('width', '100%');
        setTimeout(function() {
            $('#progress-info-container').css('opacity', '0');
        }, 350);

        var vertexIndices = data.res.vertexIndices;
        var vertexPositions = data.res.vertexPositions;

        var indices = new Uint32Array(vertexIndices);
        var positions = new Float32Array(vertexPositions);

        var geo = new THREE.BufferGeometry();
        geo.setIndex(new THREE.BufferAttribute(indices, 1));
        geo.addAttribute('position', new THREE.BufferAttribute(positions, 3));

        geo.computeVertexNormals();

        var mat = new THREE.MeshNormalMaterial({
            side: THREE.DoubleSide
        });

        var mesh = new THREE.Mesh(geo, mat);

        Grapher._3D.Main.surfaces.children.forEach(function(s) {
            if (s.name == data.id)
                s.add(mesh);
        });
    } else if (data.action == 'progress') {
        // only use progress data from worker #1 to avoid
        // erratic changes
        if (data.workerId == 1) {
            var width = Math.round(data.progress * 100) + '%';
            $('.progress-bar').css('width', width);
        }
    } else if (data.error && data.workerId == 1) {
        console.log("ERROR");
        setTimeout(function() {
            $('#progress-info-container').css('opacity', '0');
        }, 50);
    }
}

worker1.onmessage = handleMessage;
worker2.onmessage = handleMessage;
worker3.onmessage = handleMessage;
worker4.onmessage = handleMessage;


Grapher.EquationEntries = {};
Grapher.Options = {
    // This coefficient changes the mapping from
    // world coordinates to coordinates used for graphing
    // i.e. x_graph = zoomCoeff * x_world
    zoomCoeff: 1,
    // Resolution / step size
    res: 0.1
};

function processLatex(latex) {
    // matrices
    latex = latex.replace(/\\begin{[bp]matrix}(.*?)\\end{[bp]matrix}/g, function(_, m) {
        return "([" + m.replace(/\&/g, ",").replace(/\\\\/g, ";") + "])";
    });

    latex = latex.replace(/\\left/g, "");
    latex = latex.replace(/\\right/g, "");
    latex = latex.replace(/\\sin/g, "sin");
    latex = latex.replace(/\\cos/g, "cos");
    latex = latex.replace(/\\tan/g, "tan");
    latex = latex.replace(/\\log/g, "log");
    latex = latex.replace(/\\ln/g, "log");
    latex = latex.replace(/\\pi/g, "pi ");
    latex = latex.replace(/\\Gamma/g, "gamma");
    latex = latex.replace(/\\cdot/g, "*");
    latex = latex.replace(/\\operatorname\{abs\}/g, "abs");
    latex = latex.replace(/\^{(.*?)}/g, "^($1)");
    return latex;
}

function processText(text) {
    text = text.replace(/f\*\(x\*,\*y\)/g, "z");
    text = text.replace(/f\*\(y\*,\*x\)/g, "z");
    text = text.replace(/f\*\(y\*,\*z\)/g, "x");
    text = text.replace(/f\*\(z\*,\*y\)/g, "x");
    text = text.replace(/f\*\(x\*,\*z\)/g, "y");
    text = text.replace(/f\*\(z\*,\*x\)/g, "y");

    text = text.replace(/\\s\*i\*n \*/g, "sin");
    text = text.replace(/\\c\*o\*s \*/g, "cos");
    text = text.replace(/\\t\*a\*n \*/g, "tan");

    text = text.replace(/\\s\*e\*c \*/g, "sec");
    text = text.replace(/\\c\*s\*c \*/g, "csc");
    text = text.replace(/\\c\*o\*t \*/g, "cot");

    text = text.replace(/\\m\*a\*x \*/g, "max");
    text = text.replace(/\\m\*i\*n \*/g, "min");

    text = text.replace(/\\a\*b\*s \*/g, "abs");

    text = text.replace(/\\e\*x\*p \*/g, "exp");

    text = text.replace(/\\l\*n \*/g, "ln");
    text = text.replace(/\\l\*o\*g \*/g, "log");

    text = text.replace(/\\g\*a\*m\*m\*a \*/g, "gamma");

    text = text.replace(/\\operatorname\{(.*?)\}\*/g, function(_, m) {
        return m.replace(/\*/g, "");
    });

    text = text.replace(/([a-zA-Z])\*,/g, "$1,");

    return text;
}

function getVariables(eqStr) {
    var expr = math.parse(eqStr);

    var variables = [];

    expr.traverse(function(node) {
        if (node.type == 'SymbolNode') {
            variables.push(node.name);
        }
    });

    return variables;
}

var MQ = MathQuill.getInterface(2);

var mathFieldEle = document.querySelector(".eq-input");
var mathField = MQ.MathField(mathFieldEle, {
    spaceBehavesLikeTab: true,
    charsThatBreakOutOfSupSub: '+-=<>',
    handlers: {
        edit: function() {}
    }
})

Grapher._3D.editGraph = function(latex, text, eqId, domain) {
    Grapher._3D.removeGraph(eqId);
    Grapher.EquationEntries[eqId] = {
        latex: latex,
        text: text,
        domain: domain
    };

    try {
        var res = dograph(latex, text, eqId, domain);
        var obj = res.obj;
        obj = res.obj;
        obj.name = eqId;
        Grapher._3D.Main.surfaces.add(obj);

        return {ok: true, type: res.type};
    } catch (err) {
        console.log(err);
        return {error: "I can't graph this"};
    }
}

Grapher._3D.removeGraph = function(eqId) {
    delete Grapher.EquationEntries[eqId];
    Grapher._3D.Main.surfaces.children.forEach(function(s) {
        if (s.name == eqId)
            Grapher._3D.Main.surfaces.remove(s);
    });
}

Grapher._3D.refreshAll = function() {
    for (id in Grapher.EquationEntries) {
        var entry = Grapher.EquationEntries[id];
        Grapher._3D.editGraph(entry.latex, entry.text, id, entry.domain);
    }
}

function dograph(latex, text, id, domain) {
    var obj;
    var type;

    var vecComponents = extractVectorComponents(latex);
    var pointComponents = extractPointComponents(text);
    var parametricComponents = extractParametric(latex);

    var lowerDomainT = 0, upperDomainT = 1;
    try {
        lowerDomainT = math.eval(processText(domain.t_lower));
        upperDomainT = math.eval(processText(domain.t_upper));
    } catch (e) {}
    var lowerDomainU = 0, upperDomainU = 1;
    try {
        lowerDomainU = math.eval(processText(domain.u_lower));
        upperDomainU = math.eval(processText(domain.u_upper));
    } catch (e) {}
    var lowerDomainV = 0, upperDomainV = 1;
    try {
        lowerDomainV = math.eval(processText(domain.v_lower));
        upperDomainV = math.eval(processText(domain.v_upper));
    } catch (e) {}


    var paramMode = undefined;
    if (parametricComponents) {
        var arr = parametricComponents;
        if (arr[0] == 'x' && arr[1] == 'y' && arr[2] == 'z') {
            paramMode = 'rectangular';
        } else if (arr[0] == 'r' && arr[1] == '\\theta' && arr[2] == 'z') {
            paramMode = 'cylindrical';
        } else if (arr[0] == 'r' && arr[1] == '\\theta' && arr[2] == '\\phi') {
            paramMode = 'spherical';
        }
    }


    var vfComponents = extractVF(latex);
    if (parametricComponents && paramMode !== undefined) {
        var vec = math.compile(parametricComponents[3]);
        var vecExpr = math.parse(parametricComponents[3]);

        var tParamerized = exprContainsSymbol(vecExpr, 't');
        var uvParamerized = exprContainsSymbol(vecExpr, 'u') && exprContainsSymbol(vecExpr, 'v');

        var zc = Grapher.Options.zoomCoeff;
        if (uvParamerized) {
            var func = function(u, v) {
                u = lowerDomainU + (upperDomainU - lowerDomainV) * u;
                v = lowerDomainV + (upperDomainV - lowerDomainV) * v;
                var evalVec = vec.eval({u: u, v: v});
                var x = evalVec._data[0][0];
                var y = evalVec._data[1][0];
                var z = evalVec._data[2][0];
                if (paramMode == 'cylindrical') {
                    var xNew = x * Math.cos(y);
                    var yNew = x * Math.sin(y);
                    x = xNew;
                    y = yNew;
                } else if (paramMode == 'spherical') {
                    var xNew = x * Math.sin(y) * Math.cos(z);
                    var yNew = x * Math.sin(y) * Math.sin(z);
                    var zNew = x * Math.cos(y);
                    x = xNew;
                    y = yNew;
                    z = zNew;
                }
                return new THREE.Vector3(x/zc, y/zc, z/zc);
            }
            var geo = new THREE.ParametricGeometry(func, 100, 100);
            var mat = new THREE.MeshNormalMaterial({side: THREE.DoubleSide});
            var mesh = new THREE.Mesh(geo, mat);
            obj = mesh;
            type = 'parametric_uv';
        } else {
           var Parametric = THREE.Curve.create(
                function() {},
                function(t) {
                    // change 0 < t < 1 to lowerDomain < t < upperDomain
                    t = lowerDomainT + (upperDomainT - lowerDomainT) * t;
                    var evalVec = vec.eval({t: t});

                    var x = evalVec._data[0][0];
                    var y = evalVec._data[1][0];
                    var z = evalVec._data[2][0];
                    if (paramMode == 'cylindrical') {
                        var xNew = x * Math.cos(y);
                        var yNew = x * Math.sin(y);
                        x = xNew;
                        y = yNew;
                    } else if (paramMode == 'spherical') {
                        var xNew = x * Math.sin(y) * Math.cos(z);
                        var yNew = x * Math.sin(y) * Math.sin(z);
                        var zNew = x * Math.cos(y);
                        x = xNew;
                        y = yNew;
                        z = zNew;
                    }
                    return new THREE.Vector3(x/zc, y/zc, z/zc);
                }
            );

            var curve = new Parametric();
            var d = new Date();
            var geo = new THREE.TubeGeometry(curve, 600, 0.04/zc, 15, false);
            console.log(new Date() - d);
            for (var i = 0; i < geo.faces.length; i++) {
                var face = geo.faces[i];
                var h = Math.floor(i/30);
                face.color.setHSL(h/600, 0.75, 0.5);
            }
            var mesh = new THREE.Mesh(
                geo,
                new THREE.MeshStandardMaterial({
                    side: THREE.DoubleSide,
                    vertexColors: THREE.FaceColors
                })
            );

            obj = mesh;
            type = 'parametric';
        }

    } else if (vfComponents) {
        obj = new THREE.Object3D();
        var vec = math.compile(vfComponents);

        var zc = Grapher.Options.zoomCoeff;
        for (var x = -3; x <= 3; x += 1) {
            for (var y = -3; y <= 3; y += 1) {
                for (var z = -3; z <= 3; z += 1) {
                    var ctx = {x:zc*x, y:zc*y, z:zc*z};
                    var evalVec = vec.eval(ctx);

                    var v = new THREE.Vector3(
                        evalVec._data[0][0],
                        evalVec._data[1][0],
                        evalVec._data[2][0]
                    );
                    var len = v.length();
                    if (len == 0) continue;
                    v.normalize();
                    var color = new THREE.Color().setHSL(Math.abs(len-5)/10.0, 1, 0.5);
                    var arrow = new CustomArrow(
                        v, new THREE.Vector3(x,y,z), 0.85,
                        color, undefined, 0.25, 2, THREE.MeshStandardMaterial
                    );
                    obj.add(arrow);
                }
            }
        }

        type = 'vectorfield';
    } else if (vecComponents) {
        var v1 = math.eval(vecComponents[0]),
            v2 = math.eval(vecComponents[1]),
            v3 = math.eval(vecComponents[2]);

        var vec = new THREE.Vector3(v1, v2, v3).divideScalar(Grapher.Options.zoomCoeff);

        var norm = vec.length();
        vec.normalize();
        var color = new THREE.Color().setHSL(Math.random(), 1, 0.5);
        var arrow = new CustomArrow(
            vec, new THREE.Vector3(0, 0, 0), norm,
            color, undefined, 0.25, 5.0, THREE.MeshStandardMaterial
        );

        obj = arrow;
        type = 'vector';
    } else if (pointComponents) {
        var v1 = math.eval(pointComponents[0]),
            v2 = math.eval(pointComponents[1]),
            v3 = math.eval(pointComponents[2]);

        var geo = new THREE.SphereGeometry(0.1, 20, 20);
        var mat = new THREE.MeshStandardMaterial({color: 0x0000FF});
        var dot = new THREE.Mesh(geo, mat);
        dot.position.set(v1, v2, v3);
        dot.position.divideScalar(Grapher.Options.zoomCoeff);

        obj = dot;
        type = 'point';
    } else {
        var eq = processText(text);
        var parts = eq.split("=");
        if (parts.length != 2) return;

        var lh = parts[0],
            rh = parts[1];
        if (lh.length < 1 || rh.length < 1) return;

        var lhExpr = math.parse(lh),
            rhExpr = math.parse(rh);

        var msg = {
            id: id,
            action: '2d_create',
            step: Grapher.Options.res,
            zc: Grapher.Options.zoomCoeff,
            zmin: -3,
            zmax: 3
        };

        if (lh === 'x' && !exprContainsSymbol(rhExpr, 'x')) {
            msg.eq = rh;
            msg.dependent = 'x';
        } else if (rh === 'x' && !exprContainsSymbol(lhExpr, 'x')) {
            msg.eq = lh;
            msg.dependent = 'x';
        } else if (lh === 'y' && !exprContainsSymbol(rhExpr, 'y')) {
            msg.eq = rh;
            msg.dependent = 'y';
        } else if (rh === 'y' && !exprContainsSymbol(lhExpr, 'y')) {
            msg.eq = lh;
            msg.dependent = 'y';
        } else if (lh === 'z' && !exprContainsSymbol(rhExpr, 'z')) {
            msg.eq = rh;
            msg.dependent = 'z';
        } else if (rh === 'z' && !exprContainsSymbol(lhExpr, 'z')) {
            msg.eq = lh;
            msg.dependent = 'z';
        } else {
            // one variable is not isolated, use isosurface instead

            // create a scalar field f(x, y, z) so f(x, y, z) = 0
            // represents the surface.
            msg.eq = lh + "-(" + rh + ")";
            msg.action = 'iso_create';
        }

        console.log(msg);

        msg.xmin = -3;
        msg.xmax = 0;
        msg.ymin = -3;
        msg.ymax = 0;
        // -3, 0 and -3, 0
        msg.workerId = 1;
        worker1.postMessage(msg);
        msg.ymin = 0;
        msg.ymax = 3;
        // -3, 0 and 0, 3
        msg.workerId = 2;
        worker2.postMessage(msg);
        msg.xmin = 0;
        msg.xmax = 3;
        // 0, 3 and 0, 3
        msg.workerId = 3;
        worker3.postMessage(msg);
        msg.ymin = -3;
        msg.ymax = 0;
        // 0, 3 and -3, 0
        msg.workerId = 4;
        worker4.postMessage(msg);

        $('.progress-bar').remove();
        $('#progress-info-container').append('<div class="progress-bar"></div>');
        $('#progress-info-container').css('opacity', '1');

        obj = new THREE.Object3D();
        type = 'surface';
    }

    return {obj: obj, type: type};
}
exports.dograph = dograph;

function extractVectorComponents(latex) {
    var regex = /^\\begin{bmatrix}(.*?)\\\\(.*?)\\\\(.*?)\\end{bmatrix}$/;
    var matches = regex.exec(latex);
    if (matches == null) {
        return null;
    } else {
        return matches.slice(1).map(function(e) {
            return processLatex(e)
        });
    }
}

function extractPointComponents(text) {
    text = processText(text);
    var regex = /^\((.*?)\s*,\s*(.*?)\s*,\s*(.*?)\)$/;
    var matches = regex.exec(text);
    if (matches == null) {
        return null
    } else {
        return matches.slice(1);
    }
}

function extractParametric(latex) {
    var regex = /^\\begin{bmatrix}(.*?)\\\\(.*?)\\\\(.*?)\\end{bmatrix}=(.*)$/;
    var matches = regex.exec(latex);
    if (matches == null) {
        return null;
    } else {
        var res = matches.slice(1);
        res[3] = processLatex(res[3]);
        return res;
    }
}

function extractVF(latex) {
    var regex = /^\\Delta\\begin{bmatrix}x\\\\y\\\\z\\end{bmatrix}=(.*)$/;
    var matches = regex.exec(latex);
    if (matches == null) {
        return null;
    } else {
        var res = matches[1];
        return processLatex(res);
    }
}
