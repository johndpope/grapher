var Grapher = require('./3d.js');
var math = require('mathjs');
var CustomArrow = require('./CustomArrow.js');
var createIsoSurface = require('./mc.js').createIsoSurface;

Grapher.EquationEntries = {};
Grapher.Options = {
    // This coefficient changes the mapping from
    // world coordinates to coordinates used for graphing
    // i.e. x_graph = zoomCoeff * x_world
    zoomCoeff: 1,
    // Resolution in xyz directions. Specifies
    // the step size used when creating a surface.
    xRes: 0.1,
    yRes: 0.1,
    zRes: 0.1
};

function processLatex(latex) {
    latex = latex.replace(/\\left/g, "");
    latex = latex.replace(/\\right/g, "");
    latex = latex.replace(/\\sin/g, "sin");
    latex = latex.replace(/\\cos/g, "cos");
    latex = latex.replace(/\\tan/g, "tan");
    latex = latex.replace(/\\log/g, "log");
    latex = latex.replace(/\\ln/g, "log");
    latex = latex.replace(/\\pi/g, "pi ");
    latex = latex.replace(/\\cdot/g, "*");
    latex = latex.replace(/\\operatorname\{abs\}/g, "abs");
    latex = latex.replace(/\^{(.*?)}/g, "^($1)");

    return latex;
}

function processText(text) {
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

Grapher._3D.editGraph = function(latex, text, eqId) {
    Grapher._3D.removeGraph(eqId);
    Grapher.EquationEntries[eqId] = {
        latex: latex,
        text: text
    };

    try {
        var res = dograph(latex, text);
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
        var latex = Grapher.EquationEntries[id].latex;
        var text = Grapher.EquationEntries[id].text;
        Grapher._3D.editGraph(latex, text, id);
    }
}

function dograph(latex, text) {
    var obj;
    var type;

    var vecComponents = extractVectorComponents(latex);
    var pointComponents = extractPointComponents(text);
    var parametricComponents = extractParametricComponents(latex);

    var paramMode = undefined;
    if (parametricComponents) {
        var arr = parametricComponents;
        if (arr[0] == 'x' && arr[1] == 'y' && arr[2] == 'z') {
            paramMode = 'rectangular';
        } else if (arr[0] == 'r' && arr[1] == '\\theta' && arr[2] == 'z') {
            paramMode = 'cylindrical';
        }
    }
    console.log("parametric mode", paramMode);
    var vfComponents = extractVFComponents(latex);
        if (parametricComponents && paramMode !== undefined) {
        var xComp = math.compile(parametricComponents[3]);
        var yComp = math.compile(parametricComponents[4]);
        var zComp = math.compile(parametricComponents[5]);

        var zc = Grapher.Options.zoomCoeff;
        var Parametric = THREE.Curve.create(
            function() {},
            function(t) {
                var x = xComp.eval({t: t/zc});
                var y = yComp.eval({t: t/zc});
                var z = zComp.eval({t: t/zc});
                if (paramMode == 'cylindrical') {
                    var xNew = x * Math.cos(y);
                    var yNew = x * Math.sin(y);
                    x = xNew;
                    y = yNew;
                }
                return new THREE.Vector3(x/zc, y/zc, z/zc);
            }
        );

        var curve = new Parametric();
        console.log(curve.getTangentAt);
        var geo = new THREE.TubeGeometry(curve, 300, 0.04, 9, false);
        var mesh = new THREE.Mesh(geo, new THREE.MeshNormalMaterial({side: THREE.DoubleSide}));

        obj = mesh;
        type = 'parametric';
    } else if (vfComponents) {
        obj = new THREE.Object3D();
        var xComp = math.compile(vfComponents[0]);
        var yComp = math.compile(vfComponents[1]);
        var zComp = math.compile(vfComponents[2]);

        var zc = Grapher.Options.zoomCoeff;
        for (var x = -3; x <= 3; x += 1) {
            for (var y = -3; y <= 3; y += 1) {
                for (var z = -3; z <= 3; z += 1) {
                    var ctx = {x:zc*x, y:zc*y, z:zc*z};
                    var vecX = xComp.eval(ctx);
                    var vecY = yComp.eval(ctx);
                    var vecZ = zComp.eval(ctx);

                    var vec = new THREE.Vector3(vecX, vecY, vecZ);
                    var len = vec.length();
                    if (len == 0) continue;
                    vec.normalize();
                    var color = new THREE.Color().setHSL(Math.abs(len-5)/10.0, 1, 0.5);
                    var arrow = new CustomArrow(
                        vec, new THREE.Vector3(x,y,z), 1,
                        color, undefined, 0.25, 5
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
            color, undefined, 0.25, 5.0
        );

        obj = arrow;
        type = 'vector';
    } else if (pointComponents) {
        var v1 = math.eval(pointComponents[0]),
            v2 = math.eval(pointComponents[1]),
            v3 = math.eval(pointComponents[2]);

        var geo = new THREE.SphereGeometry(0.1, 20, 20);
        var mat = new THREE.MeshBasicMaterial({color: 0x0000FF});
        var dot = new THREE.Mesh(geo, mat);
        dot.position.set(v1, v2, v3);
        dot.position.divideScalar(Grapher.Options.zoomCoeff);

        obj = dot;
        type = 'point';
    } else {
        var eq = processText(text);
        var parts = eq.split("=");
        if (parts.length != 2) return;

        var eq = parts[0] + "-(" + parts[1] + ")";
        var expr = math.compile(eq);

        var _f = function(x, y, z) {
            return expr.eval({
                x: x,
                y: y,
                z: z
            });
        };

        var f = _f;

        var d = new Date();
        console.log("Starting isosurface creation");
        var zc = Grapher.Options.zoomCoeff;
        var geo = createIsoSurface(
            f, 0,
            -3, 3, -3, 3, -3, 3,
            0.1, zc
        );
        console.log("Finished isosurface creation", new Date() - d);
        var mat = new THREE.MeshNormalMaterial({side: THREE.DoubleSide});
        var mesh = new THREE.Mesh(geo, mat);

        obj = mesh;
        type = 'surface';
    }

    return {obj: obj, type: type};
}
exports.dograph = dograph;

function extractVectorComponents(latex) {
    latex = processLatex(latex);
    var regex = /^\\begin{bmatrix}(.*?)\\\\(.*?)\\\\(.*?)\\end{bmatrix}$/;
    var matches = regex.exec(latex);
    if (matches == null) {
        return null;
    } else {
        return matches.slice(1);
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

function extractParametricComponents(latex) {
    latex = processLatex(latex)
    var regex = /^\\begin{bmatrix}(.*?)\\\\(.*?)\\\\(.*?)\\end{bmatrix}=\\begin{bmatrix}(.*?)\\\\(.*?)\\\\(.*?)\\end{bmatrix}$/;
    var matches = regex.exec(latex);
    if (matches == null) {
        return null;
    } else {
        return matches.slice(1);
    }
}

function extractVFComponents(latex) {
    latex = processLatex(latex);
    var regex = /^\\nabla\\begin{bmatrix}x\\\\y\\\\z\\end{bmatrix}=\\begin{bmatrix}(.*?)\\\\(.*?)\\\\(.*?)\\end{bmatrix}$/;
    var matches = regex.exec(latex);
    if (matches == null) {
        return null;
    } else {
        console.log("GOOD VF", matches.slice(1));
        return matches.slice(1);
    }
}
