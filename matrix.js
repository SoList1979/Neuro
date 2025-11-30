// matrix.js — Анимированный фон "Матрица"
const canvas = document.getElementById("matrix-canvas");
const gl = canvas.getContext("webgl");

if (!gl) {
    console.error("WebGL не поддерживается");
    throw new Error("WebGL not supported");
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener("resize", resize);
resize();

const vsSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const fsSource = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform float u_time;
  varying vec2 v_texCoord;
  void main() {
    vec4 texColor = texture2D(u_texture, v_texCoord);
    float fade = 0.97 + 0.03 * sin(u_time * 0.1);
    gl_FragColor = vec4(texColor.rgb * fade, texColor.a);
  }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(
            "Ошибка компиляции шейдера:",
            gl.getShaderInfoLog(shader)
        );
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Ошибка линковки программы:", gl.getProgramInfoLog(program));
    throw new Error("Failed to link program");
}

const posLoc = gl.getAttribLocation(program, "a_position");
const texLoc = gl.getAttribLocation(program, "a_texCoord");
const timeLoc = gl.getUniformLocation(program, "u_time");

const verts = new Float32Array([
    -1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, -1, 1, 0, 0, 1, -1, 1, 1, 1, 1, 1,
    0,
]);
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

function createFBO() {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        canvas.width,
        canvas.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
    );
    return { fbo, texture };
}

let backBuffer = createFBO();
let frontBuffer = createFBO();

const tempCanvas = document.createElement("canvas");
tempCanvas.width = canvas.width;
tempCanvas.height = canvas.height;
const ctx = tempCanvas.getContext("2d", { willReadFrequently: false });

const CHAR_SET =
    "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const fontSize = 16;

function initColumns() {
    return Array(Math.ceil(canvas.width / fontSize))
        .fill()
        .map(() => ({
            x: Math.random() * canvas.width,
            y: -Math.random() * canvas.height,
            speed: 1 + Math.random() * 2,
            length: 5 + Math.random() * 30,
            chars: Array(40)
                .fill()
                .map(
                    () => CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)]
                ),
        }));
}

let columns = initColumns();

function drawRain() {
    // Сброс трансформации
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Чистка с полупрозрачной заливкой для шлейфа
    ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = "center";

    columns.forEach((col) => {
        col.y += col.speed * 0.5;

        // Если колонка ушла за нижний край — перезапускаем сверху
        if (col.y > canvas.height + 20) {
            col.y = -20;
            col.x = Math.random() * canvas.width;
            col.speed = 1 + Math.random() * 2;
        }

        for (let i = 0; i < col.length; i++) {
            const y = col.y - i * fontSize;
            if (y < -20 || y > canvas.height) continue;

            const alpha = (col.length - i) / col.length;
            const brightness = i === 0 ? 1 : 0.3 + 0.7 * alpha;
            ctx.fillStyle = `rgba(0, ${Math.floor(
                255 * brightness
            )}, 0, ${alpha})`;
            ctx.fillText(col.chars[i], col.x, y);
        }
    });

    // Загружаем в текстуру без отражения
    gl.bindTexture(gl.TEXTURE_2D, backBuffer.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        tempCanvas
    );
}

function render(time) {
    time *= 0.001;

    if (
        canvas.width !== window.innerWidth ||
        canvas.height !== window.innerHeight
    ) {
        resize();
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        columns = initColumns();
        backBuffer = createFBO();
        frontBuffer = createFBO();
    }

    drawRain();

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 4 * 4, 0);
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, backBuffer.texture);
    gl.uniform1f(timeLoc, time);

    gl.bindFramebuffer(gl.FRAMEBUFFER, frontBuffer.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    [backBuffer, frontBuffer] = [frontBuffer, backBuffer];

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, frontBuffer.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);
