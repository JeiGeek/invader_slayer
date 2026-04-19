// ============================================================
//  NAVES — BATALLA INTERESTELAR
//  videojuego-javascript.js — Versión mejorada completa
// ============================================================

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) { window.setTimeout(callback, 1000 / 60); };
})();

arrayRemove = function (array, from) {
    var rest = array.slice((from) + 1 || array.length);
    array.length = from < 0 ? array.length + from : from;
    return array.push.apply(array, rest);
};

Array.prototype.containsElement = function (element) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] == element) return true;
    }
    return false;
};

// ============================================================
//  AUDIO ENGINE (Web Audio API — sin archivos externos)
// ============================================================
var AudioEngine = (function () {
    var ctx = null, musicGain = null, sfxGain = null,
        musicLoop = null, musicEnabled = true, sfxEnabled = true;

    function init() {
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            musicGain = ctx.createGain();
            sfxGain   = ctx.createGain();
            musicGain.gain.value = 0.35;
            sfxGain.gain.value   = 0.6;
            musicGain.connect(ctx.destination);
            sfxGain.connect(ctx.destination);
        } catch(e) { ctx = null; }
    }

    function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

    function noise(freq, type, dur, vol, dest) {
        if (!ctx || !sfxEnabled) return;
        try {
            var osc = ctx.createOscillator();
            var g   = ctx.createGain();
            osc.type = type || 'square';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            g.gain.setValueAtTime(vol || 0.3, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
            osc.connect(g);
            g.connect(dest || sfxGain);
            osc.start(); osc.stop(ctx.currentTime + dur);
        } catch(e) {}
    }

    function sweep(f1, f2, dur, type, vol) {
        if (!ctx || !sfxEnabled) return;
        try {
            var osc = ctx.createOscillator();
            var g   = ctx.createGain();
            osc.type = type || 'sawtooth';
            osc.frequency.setValueAtTime(f1, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(f2, ctx.currentTime + dur);
            g.gain.setValueAtTime(vol || 0.3, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
            osc.connect(g); g.connect(sfxGain);
            osc.start(); osc.stop(ctx.currentTime + dur);
        } catch(e) {}
    }

    // ================================================================
    //  MÚSICA PROCEDURAL — 3 temas: menú, juego, jefe
    // ================================================================
    var musicInterval = null;
    var currentTheme  = null;   // 'menu' | 'game' | 'boss'

    // ── Utilidad: nota con envolvente ADSR ──────────────────────
    function playNote(freq, dur, type, vol, dest, detune) {
        if (!ctx || !musicEnabled) return;
        try {
            var osc = ctx.createOscillator();
            var env = ctx.createGain();
            osc.type = type || 'triangle';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            if (detune) osc.detune.setValueAtTime(detune, ctx.currentTime);
            var a = 0.01, d = dur * 0.15, s = vol * 0.7, r = dur * 0.4;
            env.gain.setValueAtTime(0, ctx.currentTime);
            env.gain.linearRampToValueAtTime(vol, ctx.currentTime + a);
            env.gain.linearRampToValueAtTime(s,   ctx.currentTime + a + d);
            env.gain.setValueAtTime(s, ctx.currentTime + dur - r);
            env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
            osc.connect(env);
            env.connect(dest || musicGain);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + dur);
        } catch(e) {}
    }

    // ── Bajo (sub-oscilador cuadrado grave) ──────────────────────
    function playBass(freq, dur, vol) {
        if (!ctx || !musicEnabled) return;
        try {
            var osc = ctx.createOscillator();
            var flt = ctx.createBiquadFilter();
            var env = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq / 2, ctx.currentTime);
            flt.type = 'lowpass'; flt.frequency.value = 400;
            env.gain.setValueAtTime(0, ctx.currentTime);
            env.gain.linearRampToValueAtTime(vol || 0.18, ctx.currentTime + 0.01);
            env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
            osc.connect(flt); flt.connect(env); env.connect(musicGain);
            osc.start(); osc.stop(ctx.currentTime + dur);
        } catch(e) {}
    }

    // ── Percusión sintética ──────────────────────────────────────
    function playKick(vol) {
        if (!ctx || !musicEnabled) return;
        try {
            var osc = ctx.createOscillator();
            var env = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(160, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.12);
            env.gain.setValueAtTime(vol || 0.5, ctx.currentTime);
            env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
            osc.connect(env); env.connect(musicGain);
            osc.start(); osc.stop(ctx.currentTime + 0.2);
        } catch(e) {}
    }

    function playSnare(vol) {
        if (!ctx || !musicEnabled) return;
        try {
            var buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
            var data = buf.getChannelData(0);
            for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
            var src = ctx.createBufferSource();
            var flt = ctx.createBiquadFilter();
            var env = ctx.createGain();
            src.buffer = buf;
            flt.type = 'bandpass'; flt.frequency.value = 2800; flt.Q.value = 0.8;
            env.gain.setValueAtTime(vol || 0.22, ctx.currentTime);
            env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
            src.connect(flt); flt.connect(env); env.connect(musicGain);
            src.start(); src.stop(ctx.currentTime + 0.12);
        } catch(e) {}
    }

    function playHihat(vol) {
        if (!ctx || !musicEnabled) return;
        try {
            var buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
            var data = buf.getChannelData(0);
            for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
            var src = ctx.createBufferSource();
            var flt = ctx.createBiquadFilter();
            var env = ctx.createGain();
            src.buffer = buf;
            flt.type = 'highpass'; flt.frequency.value = 7000;
            env.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
            env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
            src.connect(flt); flt.connect(env); env.connect(musicGain);
            src.start(); src.stop(ctx.currentTime + 0.06);
        } catch(e) {}
    }

    // ================================================================
    //  TEMA 1: MENÚ — ambiental espacial, lento y atmosférico
    //  Escala pentatónica menor en Do, BPM 75, sin percusión fuerte
    // ================================================================
    var menuTheme = (function() {
        // Pentatónica menor: C3 Eb3 F3 G3 Bb3 / C4 Eb4 F4 G4 Bb4
        var penta = [130.81, 155.56, 174.61, 196.00, 233.08,
                     261.63, 311.13, 349.23, 392.00, 466.16];
        // Melodía principal — arpegio suave ascendente/descendente
        var melSeq  = [0,2,4,5,7,9,7,5,4,2,1,3,5,7,8,6,4,3,1,0];
        // Contrapunto — notas más largas debajo
        var bassSeq = [0,0,2,2,4,4,2,2,0,0,1,1,3,3,4,4];
        var step = 0, bstep = 0;
        var bpm = 75;
        var eighth = (60 / bpm) / 2 * 1000; // ms por corchea

        function tick() {
            if (!musicEnabled) return;
            var mel = penta[melSeq[step % melSeq.length]];
            // Melodía con triangle — suave y espacial
            playNote(mel * 2, 0.38, 'triangle', 0.07);
            // Cada 4 pasos, contrapunto con sine
            if (step % 4 === 0) {
                var bas = penta[bassSeq[bstep % bassSeq.length]];
                playNote(bas, 0.75, 'sine', 0.06);
                bstep++;
            }
            // Hihat muy suave en cada paso
            if (step % 2 === 0) playHihat(0.04);
            step++;
        }
        return { tick: tick, interval: eighth };
    })();

    // ================================================================
    //  TEMA 2: JUEGO — ritmo intenso, energético, space shooter
    //  Escala menor natural en La, BPM 140, con bajo y batería
    // ================================================================
    var gameTheme = (function() {
        // Menor natural de La: A3 B3 C4 D4 E4 F4 G4 A4
        var minor = [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00];
        // Melodía rítmica — patrón de acción
        var melSeq  = [4,4,7,4,5,3,4,0, 4,4,7,6,5,4,3,2,
                       3,3,5,3,4,2,3,0, 5,5,7,5,6,4,5,3];
        // Bajo — raíz + quinta alternando
        var bassSeq = [0,0,4,0,0,4,0,4, 3,3,3,0,2,2,2,0];
        // Patrón de batería — kick en 1 y 3, snare en 2 y 4
        var drumPat = [1,0,0,0, 2,0,0,0, 1,0,0,0, 2,0,0,0];  // 1=kick 2=snare
        var step = 0, bstep = 0, dstep = 0;
        var bpm = 140;
        var sixteenth = (60 / bpm) / 4 * 1000;

        function tick() {
            if (!musicEnabled) return;
            // Melodía — notas más cortas y articuladas
            if (step % 2 === 0) {
                var mel = minor[melSeq[(step/2) % melSeq.length]];
                playNote(mel, 0.14, 'square', 0.06);
                // Harmónico una octava arriba cada 4 pasos (brillo)
                if (step % 8 === 0) playNote(mel * 2, 0.10, 'triangle', 0.03);
            }
            // Bajo
            if (step % 4 === 0) {
                var bas = minor[bassSeq[bstep % bassSeq.length]];
                playBass(bas, 0.28, 0.18);
                bstep++;
            }
            // Batería
            var drum = drumPat[dstep % drumPat.length];
            if (drum === 1) playKick(0.45);
            if (drum === 2) playSnare(0.20);
            // Hihat en semicorcheas
            playHihat(step % 2 === 0 ? 0.10 : 0.06);
            step++; dstep++;
        }
        return { tick: tick, interval: sixteenth };
    })();

    // ================================================================
    //  TEMA 3: JEFE — tenso, oscuro, agresivo
    //  Escala frigia de Mi, BPM 160, bajo distorsionado, batería pesada
    // ================================================================
    var bossTheme = (function() {
        // Frigia de Mi: E2 F2 G2 A2 B2 C3 D3 E3 (muy oscuro)
        var phrygian = [82.41, 87.31, 98.00, 110.00, 123.47, 130.81, 146.83, 164.81];
        // Melodía amenazante — descensos cromaticos
        var melSeq  = [7,6,5,4, 3,2,1,0, 4,3,2,1, 7,5,3,2,
                       6,5,4,3, 2,1,0,2, 5,4,3,2, 7,6,5,4];
        // Bajo distorsionado — ostinato rítmico
        var bassSeq = [0,0,0,3, 0,0,2,0, 0,0,0,4, 0,1,0,2];
        // Batería pesada — doble kick en corcheas, snare en 3
        var drumPat = [1,1,0,1, 2,1,0,1, 1,1,0,1, 2,1,1,0];
        var step = 0, bstep = 0, dstep = 0;
        var bpm = 160;
        var sixteenth = (60 / bpm) / 4 * 1000;

        function tick() {
            if (!musicEnabled) return;
            // Melodía — sawtooth distorsionado, agresivo
            if (step % 2 === 0) {
                var mel = phrygian[melSeq[(step/2) % melSeq.length]];
                playNote(mel * 4, 0.12, 'sawtooth', 0.05);
                playNote(mel * 4, 0.12, 'sawtooth', 0.03, null, 8); // leve detune para grosor
            }
            // Bajo muy grave
            if (step % 2 === 0) {
                var bas = phrygian[bassSeq[bstep % bassSeq.length]];
                playBass(bas, 0.22, 0.22);
                bstep++;
            }
            // Batería — más agresiva
            var drum = drumPat[dstep % drumPat.length];
            if (drum === 1) playKick(0.55);
            if (drum === 2) playSnare(0.28);
            playHihat(0.12);
            step++; dstep++;
        }
        return { tick: tick, interval: sixteenth };
    })();

    // ── Control principal ────────────────────────────────────────
    function startMusic(theme) {
        if (!ctx) return;
        stopMusic();
        currentTheme = theme || 'game';
        var themeObj = theme === 'menu' ? menuTheme
                     : theme === 'boss' ? bossTheme
                     : gameTheme;
        themeObj.tick();
        musicInterval = setInterval(function() {
            if (!musicEnabled) return;
            themeObj.tick();
        }, themeObj.interval);
    }

    function stopMusic() {
        if (musicInterval) { clearInterval(musicInterval); musicInterval = null; }
        currentTheme = null;
    }

    return {
        init: init,
        resume: resume,
        startMusic: startMusic,
        stopMusic: stopMusic,
        getCurrentTheme: function() { return currentTheme || 'game'; },
        setMusicVol: function(v) { if (musicGain) musicGain.gain.value = v; },
        setSfxVol: function(v)   { if (sfxGain)   sfxGain.gain.value = v;   },
        setMusicEnabled: function(v) { musicEnabled = v; if (!v) stopMusic(); else startMusic(currentTheme || 'game'); },
        setSfxEnabled: function(v) { sfxEnabled = v; },
        sfxShoot:   function() { sweep(880, 220, 0.12, 'square', 0.2); },
        sfxHit:     function() { sweep(300, 80, 0.15, 'sawtooth', 0.4); },
        sfxExplode: function() {
            sweep(200, 40, 0.3, 'sawtooth', 0.5);
            setTimeout(function() { noise(80, 'square', 0.2, 0.3); }, 60);
        },
        sfxPlayerHit: function() { sweep(440, 110, 0.25, 'square', 0.5); },
        sfxBtn:     function() { sweep(660, 880, 0.07, 'sine', 0.3); },
        sfxPause:   function() { sweep(880, 440, 0.1, 'sine', 0.3); },
        sfxBossAppear: function() {
            for (var i = 0; i < 3; i++) {
                (function(i){ setTimeout(function() { sweep(110+i*80, 55, 0.4, 'sawtooth', 0.5); }, i*150); })(i);
            }
        },
        sfxDash:    function() { sweep(600, 1200, 0.1, 'sine', 0.3); },
        sfxShield:  function() { sweep(800, 1600, 0.2, 'triangle', 0.3); },
        sfxMenuIntro: function() {
            if (!ctx || !sfxEnabled) return;
            // Melodía de bienvenida al menú
            var notes = [523, 659, 784, 659, 880, 784];
            notes.forEach(function(f, i) {
                setTimeout(function() { sweep(f, f * 1.01, 0.18, 'sine', 0.25); }, i * 120);
            });
        },
        sfxVictory: function() {
            var melody = [523, 659, 784, 1047];
            melody.forEach(function(f,i){ setTimeout(function(){ sweep(f,f*1.02,0.3,'sine',0.5); }, i*200); });
        }
    };
})();

// ============================================================
//  PARTICLE SYSTEM
// ============================================================
var Particles = (function () {
    var canvas, ctx, particles = [];

    function init() {
        canvas = document.getElementById('particleCanvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'particleCanvas';
            canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:100;width:100%;height:100%;';
            document.body.appendChild(canvas);
        }
        resize();
        window.addEventListener('resize', resize);
        ctx = canvas.getContext('2d');
        loop();
    }

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x  += p.vx;
            p.y  += p.vy;
            p.vy += 0.06;   // gravity
            p.life--;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            var a = p.life / p.maxLife;
            ctx.save();
            ctx.globalAlpha = a;
            ctx.fillStyle   = p.color;
            ctx.shadowBlur  = 6;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        requestAnimFrame(loop);
    }

    function burst(x, y, color, count, spread) {
        color  = color  || '#00e6ff';
        count  = count  || 12;
        spread = spread || 3;
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 0.5 + Math.random() * spread;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                r: 2 + Math.random() * 3,
                color: color,
                life: 20 + Math.random() * 30,
                maxLife: 50
            });
        }
    }

    function shoot(x, y, color) { burst(x, y, color || '#00e6ff', 5, 1.5); }

    return { init: init, burst: burst, shoot: shoot };
})();

// ============================================================
//  MAIN GAME
// ============================================================
var game = (function () {

    // ---- Estado global ----
    var canvas, ctx, buffer, bufferctx,
        player, evil,
        playerShot, bgMain, bgBoss,
        bgOffset = 0,

        // Dificultad (base)
        diffConfig = {
            facil:   { evilSpeedMult:0.7, timeLimit:120, shotDelay:350 },
            normal:  { evilSpeedMult:1.0, timeLimit:90,  shotDelay:250 },
            dificil: { evilSpeedMult:1.4, timeLimit:60,  shotDelay:180 }
        },
        currentDiff = 'normal',

        // Stats de juego
        evilSpeed      = 1,
        totalEvils     = 7,
        playerLifeInit = 3,
        shotSpeed      = 5,
        playerSpeed    = 5,
        evilCounter    = 0,
        youLoose       = false,
        congratulations= false,
        gameRunning    = false,
        gamePaused     = false,
        minHorizontalOffset = 100,
        maxHorizontalOffset = 400,
        evilShots      = 5,
        evilLife       = 2,
        finalBossShots = 30,
        finalBossLife  = 12,
        totalBestScoresToShow = 5,

        // Buffers
        playerShotsBuffer = [],
        evilShotsBuffer   = [],
        evilShotImage, playerShotImage, playerKilledImage,
        evilImages  = { animation:[], killed: new Image() },
        bossImages  = { animation:[], killed: new Image() },

        // Input
        keyPressed = {},
        keyMap = { left:37, right:39, fire:32, pause:80, pauseEsc:27, dash:16, shield:83 },

        // Timing
        nextPlayerShot = 0, playerShotDelay = 250, now = 0,

        // Session ID — para cancelar setTimeout huérfanos (B4)
        gameSessionId = 0,

        // Habilidades
        dashCooldown   = 0, dashDuration = 0, isDashing = false, dashDir = 0,
        shieldActive   = false, shieldUsed = false,

        // Temporizador de nivel
        levelTimer = 60, levelTimerInterval = null,

        // Nivel actual de la partida (B3)
        currentLevel = 1,

        // Nombre jugador
        playerName = 'COMANDANTE',

        // Personaje seleccionado
        selectedChar = 0,
        charConfigs = [
            { life:3, speed:5, shotDelay:250 },
            { life:2, speed:8, shotDelay:200 },
            { life:5, speed:3, shotDelay:320 }
        ],

        // Tutorial step
        tutCurrentStep = 0, tutTotalSteps = 6,

        // Skins
        SKINS_KEY = 'naves_skins_unlocked',
        skinsData = [
            { id:'default',   name:'ORIGINAL',  unlockLevel:0, img:'images/bueno.png' },
            { id:'red',       name:'ROJO',       unlockLevel:1, img:'images/rojo.png' },
            { id:'gold',      name:'AMARILLO',   unlockLevel:3, img:'images/amarillo.png' },
            { id:'dark',      name:'OSCURO',     unlockLevel:5, img:'images/negro.png' },
            { id:'neon',      name:'DIAMANTE',   unlockLevel:7, img:'images/diamante.png' }
        ],
        selectedSkin = 'default',
        skinImages = {},

        // Logros / progreso
        PROGRESS_KEY = 'naves_progress',
        progress = { levelsCompleted:0, highScore:0 },

        // animación frame id
        animId = null;

    // ----------------------------------------------------------------
    //  SPRITES GENERADOS POR CANVAS (Interceptor y Destructor)
    // ----------------------------------------------------------------
    var charSprites = {};   // { 1: dataURL, 2: dataURL }

    function generateCharSprites() {
        charSprites[1] = drawInterceptor();
        charSprites[2] = drawDestructor();
        // Actualizar img en pantalla de selección de personaje
        var cards = document.querySelectorAll('.personaje-card');
        [1, 2].forEach(function(idx) {
            if (!cards[idx]) return;
            var wrap = cards[idx].querySelector('.char-img-wrap');
            if (!wrap) return;
            // Si estaba mostrando 🔒 reemplazamos al desbloquear, no ahora
            var img = document.createElement('img');
            img.src = charSprites[idx];
            img.alt = idx === 1 ? 'Interceptor' : 'Destructor';
            img.style.cssText = 'max-width:100%;max-height:100%;image-rendering:pixelated;';
            img.classList.add('char-sprite-gen');
            // Guardar para cuando se desbloquee
            cards[idx].setAttribute('data-sprite', charSprites[idx]);
        });
    }

    // ── INTERCEPTOR — nave delgada angular, azul/plateado ───────
    function drawInterceptor() {
        var c = document.createElement('canvas');
        c.width = 48; c.height = 48;
        var cx = c.getContext('2d');

        // Paleta
        var C = {
            body:   '#4dd9f5',   // cian claro
            dark:   '#1a8caa',   // cian oscuro
            accent: '#ffffff',   // blanco (detalles)
            engine: '#ff6600',   // naranja motor
            cockpit:'#ffe066',   // amarillo cabina
            shadow: '#0a3d52'    // sombra
        };

        function px(x, y, col) {
            cx.fillStyle = col;
            cx.fillRect(x * 3, y * 3, 3, 3);
        }

        // Diseño 16x16 en píxeles (se escala x3 = 48px)
        // Cuerpo principal — nave delgada tipo caza
        var grid = [
            '....X....X......',  // 0
            '....XXX.XXX.....',  // 1
            '...XXXXXXXX.....',  // 2
            '..XXXXXXXXXX....',  // 3
            '.XXXXXXXXXXX....',  // 4
            'XXCXXXXXXXXXX...',  // 5  C=cockpit
            '.XXXXXXXXXXX....',  // 6
            '..XXXXXXXXXX....',  // 7
            '...XXXXXXXX.....',  // 8
            '..XXXXXXXXXXX...',  // 9
            '.XXXXXXXXXXXXX..',  // 10
            'XXXXXXXXXXXXXXX.',  // 11
            '.XXXXXXXXXXXXX..',  // 12
            '..XX.XXXXX.XX...',  // 13
            '...X.XXXXX.X....',  // 14
            '....E.EEE.E.....'   // 15  E=engine
        ];

        // Nave caza — pixel art más detallado
        var rows = [
            [7,  'body'],
            [6,5, 'body'],
            [5,6,7,8, 'body'],
            [4,5,6,7,8,9, 'body'],
            [3,4,5,6,7,8,9,10, 'body'],
            [2,3,4,5,6,7,8,9,10,11, 'body'],
            [1,2,3,4,5,6,7,8,9,10,11,12, 'body'],
            [0,1,2,3,4,5,6,7,8,9,10,11,12,13, 'body'],
            [1,2,3,4,5,6,7,8,9,10,11,12, 'body'],
            [2,3,4,5,6,7,8,9,10,11, 'body'],
            [3,4,9,10, 'dark'],
            [4,5,8,9, 'dark'],
            [5,6,7,8, 'dark'],
        ];

        // Dibujar cuerpo principal (silueta)
        cx.fillStyle = C.body;
        // Columna central — fuselaje
        for (var y = 0; y < 12; y++) {
            var w = [1,2,3,4,5,6,7,6,5,4,3,2][y];
            var x0 = 8 - Math.floor(w/2);
            for (var x = x0; x < x0+w; x++) px(x, y, C.body);
        }
        // Alas — cortes angulares
        for (var y = 3; y < 9; y++) {
            var wing = (y - 3) * 2;
            for (var x = 0; x < wing && x < 7; x++) {
                px(x, y, C.body);
                px(15 - x, y, C.body);
            }
        }
        // Bordes oscuros alas
        for (var y = 3; y < 9; y++) {
            var wing = (y - 3) * 2;
            if (wing > 1) {
                px(wing - 2, y, C.dark);
                px(15 - (wing - 2), y, C.dark);
            }
        }
        // Cockpit (cabina)
        px(7, 0, C.cockpit); px(8, 0, C.cockpit);
        px(7, 1, C.cockpit); px(8, 1, C.cockpit);
        px(6, 2, C.accent);  px(9, 2, C.accent);
        // Línea central de detalle
        for (var y = 2; y < 10; y++) px(7, y, C.dark);
        for (var y = 2; y < 10; y++) px(8, y, C.dark);
        // Motores
        px(5, 11, C.engine);  px(10, 11, C.engine);
        px(5, 12, C.engine);  px(10, 12, C.engine);
        px(6, 12, C.engine);  px(9, 12, C.engine);
        // Brillo motores
        px(5, 13, '#ffaa44');  px(10, 13, '#ffaa44');
        px(6, 13, '#ffcc88');  px(9, 13, '#ffcc88');

        // Preview en pantalla de selección (mostrar en card)
        return c.toDataURL();
    }

    // ── DESTRUCTOR — nave ancha y robusta, rojo oscuro/gris ─────
    function drawDestructor() {
        var c = document.createElement('canvas');
        c.width = 48; c.height = 48;
        var cx = c.getContext('2d');

        var C = {
            body:   '#cc3333',   // rojo oscuro
            dark:   '#881111',   // rojo muy oscuro
            metal:  '#888899',   // gris metálico
            cannon: '#445566',   // cañones azul oscuro
            engine: '#ff4400',   // motor naranja intenso
            glow:   '#ff8800',   // brillo motor
            accent: '#ffcc00'    // detalles dorados
        };

        function px(x, y, col) {
            cx.fillStyle = col;
            cx.fillRect(x * 3, y * 3, 3, 3);
        }

        // Cuerpo — nave ancha tipo acorazado
        // Fuselaje central ancho
        for (var y = 1; y < 11; y++) {
            var w = [6,8,10,12,12,12,12,10,10,8][y-1] || 8;
            var x0 = 8 - Math.floor(w/2);
            for (var x = x0; x < x0+w; x++) {
                px(x, y, y < 5 ? C.body : C.metal);
            }
        }
        // Cabina acorazada
        for (var y = 0; y < 4; y++) {
            var w = [4,6,8,8][y];
            var x0 = 8 - Math.floor(w/2);
            for (var x = x0; x < x0+w; x++) px(x, y, C.body);
        }
        // Detalles oscuros en fuselaje
        for (var y = 5; y < 10; y++) {
            px(6, y, C.dark); px(9, y, C.dark);
        }
        // Línea horizontal de blindaje
        for (var x = 3; x < 13; x++) px(x, 6, C.dark);
        // Cañones laterales — característica principal del Destructor
        // Cañón izquierdo
        for (var y = 3; y < 12; y++) { px(1, y, C.cannon); px(2, y, C.cannon); }
        px(1, 12, C.cannon); px(2, 12, C.cannon);
        px(0, 4, C.cannon);  px(0, 5, C.cannon);
        px(0, 6, C.cannon);  px(0, 7, C.cannon);
        // Cañón derecho
        for (var y = 3; y < 12; y++) { px(13, y, C.cannon); px(14, y, C.cannon); }
        px(13, 12, C.cannon); px(14, 12, C.cannon);
        px(15, 4, C.cannon);  px(15, 5, C.cannon);
        px(15, 6, C.cannon);  px(15, 7, C.cannon);
        // Boca cañones (punta)
        px(1, 2, C.metal);  px(2, 2, C.metal);
        px(13, 2, C.metal); px(14, 2, C.metal);
        // Detalles dorados (insignias)
        px(7, 3, C.accent); px(8, 3, C.accent);
        px(6, 7, C.accent); px(9, 7, C.accent);
        // Motores (3 centrales)
        px(5, 11, C.engine); px(7, 11, C.engine); px(9, 11, C.engine);
        px(5, 12, C.engine); px(7, 12, C.engine); px(9, 12, C.engine);
        px(5, 13, C.glow);   px(7, 13, C.glow);   px(9, 13, C.glow);
        px(6, 13, C.glow);   px(8, 13, C.glow);

        return c.toDataURL();
    }

    // ── Al desbloquear, mostrar sprite generado en la card ───────
    function applyCharSprite(cardIdx) {
        // Buscar por ID primero (más confiable)
        var wrap = document.getElementById('charWrap' + cardIdx);
        if (!wrap) {
            // Fallback: buscar por posición en las cards
            var cards = document.querySelectorAll('.personaje-card');
            if (!cards[cardIdx]) return;
            wrap = cards[cardIdx].querySelector('.char-img-wrap');
        }
        if (!wrap) return;
        // Limpiar contenido y quitar clases de bloqueado
        wrap.innerHTML = '';
        wrap.classList.remove('locked-img');
        // Insertar imagen generada
        var img = document.createElement('img');
        img.src = charSprites[cardIdx] || '';
        img.alt = cardIdx === 1 ? 'Interceptor' : 'Destructor';
        img.style.cssText = 'max-width:100%;max-height:100%;image-rendering:pixelated;';
        wrap.appendChild(img);
    }

    // ----------------------------------------------------------------
    //  INIT
    // ----------------------------------------------------------------
    function init() {
        loadProgress();
        preloadImages();
        generateCharSprites();
        buildStars();
        buildTutDots();
        buildSkinsGrid();
        updateSkinsGrid();
        showBestScoresMenu();
        setupOptionListeners();
        showScreen('menuPrincipal');
        Particles.init();
        AudioEngine.init();
        addListener(document, 'keydown', keyDown);
        addListener(document, 'keyup',   keyUp);

        // A4: reproducir sonido de menú en la primera interacción del usuario
        // (los navegadores bloquean AudioContext hasta que hay un gesto)
        var menuSoundPlayed = false;
        function playMenuSoundOnce() {
            if (menuSoundPlayed) return;
            menuSoundPlayed = true;
            AudioEngine.resume();
            setTimeout(function() { AudioEngine.sfxMenuIntro(); }, 150);
            document.removeEventListener('click',     playMenuSoundOnce);
            document.removeEventListener('keydown',   playMenuSoundOnce);
            document.removeEventListener('touchstart', playMenuSoundOnce);
        }
        document.addEventListener('click',     playMenuSoundOnce);
        document.addEventListener('keydown',   playMenuSoundOnce);
        document.addEventListener('touchstart', playMenuSoundOnce);
    }

    // ----------------------------------------------------------------
    //  ESTRELLAS MENÚ
    // ----------------------------------------------------------------
    function buildStars() {
        var container = document.getElementById('menuStars');
        if (!container) return;
        container.innerHTML = '';
        for (var i = 0; i < 120; i++) {
            var s = document.createElement('div');
            s.className = 'star';
            s.style.left = Math.random() * 100 + '%';
            s.style.top  = Math.random() * 100 + '%';
            var dur = 2 + Math.random() * 4;
            var op  = 0.2 + Math.random() * 0.8;
            s.style.setProperty('--dur', dur + 's');
            s.style.setProperty('--op',  op);
            s.style.animationDelay = Math.random() * dur + 's';
            container.appendChild(s);
        }
    }

    // ----------------------------------------------------------------
    //  TUTORIAL
    // ----------------------------------------------------------------
    function buildTutDots() {
        var container = document.getElementById('tutDots');
        if (!container) return;
        container.innerHTML = '';
        for (var i = 0; i < tutTotalSteps; i++) {
            var d = document.createElement('div');
            d.className = 'tut-dot' + (i === 0 ? ' active' : '');
            d.setAttribute('data-i', i);
            d.onclick = (function(idx){ return function() { goToTutStep(idx); }; })(i);
            container.appendChild(d);
        }
    }

    function tutStep(dir) {
        AudioEngine.sfxBtn();
        goToTutStep(tutCurrentStep + dir);
    }
    window.game = window.game || {};

    function goToTutStep(idx) {
        var steps = document.querySelectorAll('.tut-step');
        var dots  = document.querySelectorAll('.tut-dot');
        if (idx < 0) idx = 0;
        if (idx >= tutTotalSteps) idx = tutTotalSteps - 1;
        tutCurrentStep = idx;
        steps.forEach(function(s, i) {
            s.classList.toggle('active', i === idx);
        });
        dots.forEach(function(d, i) {
            d.classList.toggle('active', i === idx);
        });
        // Actualizar demo animada
        startTutDemo(idx);
    }

    // ----------------------------------------------------------------
    //  TUTORIAL — DEMOS ANIMADAS EN CANVAS
    // ----------------------------------------------------------------
    var tutDemoAnim = null;
    var tutDemoFrame = 0;

    var tutDemoLabels = [
        'MOVIMIENTO', 'DISPARO', 'DASH', 'ESCUDO', 'PAUSA', 'CONSEJOS'
    ];

    function startTutDemo(step) {
        if (tutDemoAnim) { cancelAnimationFrame(tutDemoAnim); tutDemoAnim = null; }
        var cv = document.getElementById('tutCanvas');
        if (!cv) return;
        var cx = cv.getContext('2d');
        tutDemoFrame = 0;
        var label = document.getElementById('tutDemoLabel');
        if (label) label.textContent = tutDemoLabels[step] || '';

        var demos = [drawDemoMove, drawDemoShoot, drawDemoDash,
                     drawDemoShield, drawDemoPause, drawDemoTips];
        var fn = demos[step] || drawDemoTips;

        function loop() {
            cx.clearRect(0, 0, cv.width, cv.height);
            drawDemoBg(cx, cv.width, cv.height);
            fn(cx, cv.width, cv.height, tutDemoFrame);
            tutDemoFrame++;
            tutDemoAnim = requestAnimationFrame(loop);
        }
        loop();
    }

    function drawDemoBg(cx, w, h) {
        var g = cx.createLinearGradient(0,0,0,h);
        g.addColorStop(0, '#062040'); g.addColorStop(1, '#0a2e55');
        cx.fillStyle = g; cx.fillRect(0,0,w,h);
        // estrellas simples
        cx.fillStyle = 'rgba(200,230,255,0.6)';
        for (var i = 0; i < 18; i++) {
            cx.fillRect((i*53+7)%w, (i*37+tutDemoFrame*0.3+i*20)%h, 1.5, 1.5);
        }
    }

    function drawDemoShip(cx, x, y, color, shield) {
        cx.save();
        // Cuerpo nave
        cx.fillStyle = color || '#00e6ff';
        cx.fillRect(x-6, y-4, 12, 10);
        cx.fillRect(x-3, y-10, 6, 8);
        cx.fillRect(x-12, y, 7, 5);
        cx.fillRect(x+5,  y, 7, 5);
        // Motor
        cx.fillStyle = '#ff6600';
        cx.fillRect(x-3, y+6, 6, 3);
        cx.fillStyle = '#ffaa00';
        cx.fillRect(x-2, y+8, 4, (Math.sin(tutDemoFrame*0.3)*2)+3);
        // Escudo si aplica
        if (shield) {
            cx.strokeStyle = 'rgba(0,230,255,0.8)';
            cx.lineWidth = 2;
            cx.shadowBlur = 10; cx.shadowColor = '#00e6ff';
            cx.beginPath(); cx.arc(x, y, 22, 0, Math.PI*2); cx.stroke();
        }
        cx.restore();
    }

    function drawDemoEnemy(cx, x, y) {
        cx.save();
        cx.fillStyle = '#ff2d78';
        cx.fillRect(x-10, y-6, 20, 12);
        cx.fillRect(x-6,  y-10, 12, 6);
        cx.fillRect(x-14, y-2, 5, 6);
        cx.fillRect(x+9,  y-2, 5, 6);
        cx.fillStyle = '#ff8888';
        cx.fillRect(x-4, y-4, 4, 4);
        cx.fillRect(x+0, y-4, 4, 4);
        cx.restore();
    }

    // Demo 0: nave moviéndose de lado a lado
    function drawDemoMove(cx, w, h) {
        var t = tutDemoFrame;
        var x = w/2 + Math.sin(t * 0.025) * (w * 0.32);
        drawDemoShip(cx, x, h*0.72);
        // Flecha indicadora
        var dir = Math.cos(t * 0.025) > 0 ? 1 : -1;
        cx.fillStyle = 'rgba(0,230,255,0.7)';
        cx.font = 'bold 20px monospace';
        cx.textAlign = 'center';
        cx.fillText(dir > 0 ? '→' : '←', x + dir*30, h*0.55);
        // Trail de movimiento
        cx.fillStyle = 'rgba(0,230,255,0.15)';
        for (var i = 1; i <= 4; i++) {
            var px2 = w/2 + Math.sin((t-i*3) * 0.025) * (w * 0.32);
            cx.fillRect(px2-3, h*0.72-2, 6, 6);
        }
    }

    // Demo 1: nave disparando al enemigo
    function drawDemoShoot(cx, w, h) {
        var t = tutDemoFrame;
        var shipX = w * 0.5 + Math.sin(t*0.02)*30;
        drawDemoShip(cx, shipX, h*0.78);
        drawDemoEnemy(cx, w*0.5, h*0.22);
        // Disparos
        for (var i = 0; i < 3; i++) {
            var bulletY = h*0.78 - ((t*4 + i*50) % (h*0.8));
            if (bulletY > h*0.22 && bulletY < h*0.78) {
                cx.fillStyle = '#00e6ff';
                cx.shadowBlur = 8; cx.shadowColor = '#00e6ff';
                cx.fillRect(shipX-2, bulletY, 4, 10);
                cx.shadowBlur = 0;
            }
        }
        // Explosión cuando llega arriba
        var phase = t % 40;
        if (phase < 10) {
            cx.fillStyle = 'rgba(255,215,0,' + (1-phase/10) + ')';
            cx.beginPath(); cx.arc(w*0.5, h*0.22, phase*3, 0, Math.PI*2); cx.fill();
        }
    }

    // Demo 2: dash esquivando disparo enemigo
    function drawDemoDash(cx, w, h) {
        var t = tutDemoFrame;
        var cycle = t % 90;
        var shipX;
        var dashing = cycle > 50 && cycle < 65;
        if (cycle < 50) {
            shipX = w * 0.5;
        } else if (cycle < 65) {
            // Dash hacia la derecha
            shipX = w*0.5 + (cycle-50) * 5;
        } else {
            shipX = w*0.5 + 75 - (cycle-65)*3;
        }
        // Disparo enemigo bajando
        var bulletY = (t * 3) % h;
        var bulletX = w * 0.5;
        cx.fillStyle = '#ff2d78';
        cx.shadowBlur = 6; cx.shadowColor = '#ff2d78';
        cx.fillRect(bulletX-3, bulletY, 6, 10);
        cx.shadowBlur = 0;
        drawDemoShip(cx, shipX, h*0.72);
        // Trail del dash
        if (dashing) {
            cx.fillStyle = 'rgba(0,230,255,0.3)';
            for (var i = 1; i <= 5; i++) {
                cx.fillRect(shipX - i*14 - 5, h*0.72-3, 10, 8);
            }
            cx.fillStyle = 'rgba(255,255,0,0.8)';
            cx.font = 'bold 14px monospace';
            cx.textAlign = 'center';
            cx.fillText('⚡ DASH!', shipX, h*0.55);
        }
    }

    // Demo 3: escudo absorbiendo impacto
    function drawDemoShield(cx, w, h) {
        var t = tutDemoFrame;
        var cycle = t % 80;
        var hasShield = cycle < 60;
        // Disparo enemigo bajando hacia el jugador
        var bulletY = Math.min(h*0.72 - 22, (cycle * 3));
        cx.fillStyle = '#ff2d78';
        cx.shadowBlur = 6; cx.shadowColor = '#ff2d78';
        cx.fillRect(w*0.5 - 3, bulletY, 6, 10);
        cx.shadowBlur = 0;
        // Impacto
        if (cycle >= 55 && cycle < 65 && hasShield) {
            cx.fillStyle = 'rgba(0,230,255,' + (1-(cycle-55)/10) + ')';
            cx.beginPath(); cx.arc(w*0.5, h*0.72, (cycle-55)*5, 0, Math.PI*2); cx.fill();
            cx.fillStyle = 'rgba(0,230,255,0.8)';
            cx.font = 'bold 13px monospace';
            cx.textAlign = 'center';
            cx.fillText('¡BLOQUEADO!', w*0.5, h*0.44);
        }
        drawDemoShip(cx, w*0.5, h*0.72, '#00e6ff', hasShield);
        // Texto de tecla
        cx.fillStyle = 'rgba(0,230,255,0.6)';
        cx.font = '11px monospace';
        cx.textAlign = 'center';
        cx.fillText(hasShield ? '🛡 ESCUDO ACTIVO' : '🛡 SIN ESCUDO', w*0.5, h*0.9);
    }

    // Demo 4: pausa — freeze de la escena
    function drawDemoPause(cx, w, h) {
        var t = tutDemoFrame;
        var cycle = t % 100;
        var paused = cycle > 50;
        if (!paused) {
            drawDemoShip(cx, w*0.5 + Math.sin(t*0.05)*40, h*0.75);
            drawDemoEnemy(cx, w*0.5, h*0.25 + Math.sin(t*0.03)*15);
        } else {
            // Todo congelado, overlay semitransparente
            cx.fillStyle = 'rgba(5,6,15,0.55)';
            cx.fillRect(0,0,w,h);
            drawDemoShip(cx, w*0.5 + Math.sin(50*0.05)*40, h*0.75);
            drawDemoEnemy(cx, w*0.5, h*0.25 + Math.sin(50*0.03)*15);
            cx.fillStyle = 'rgba(0,230,255,0.95)';
            cx.font = 'bold 22px monospace';
            cx.textAlign = 'center';
            cx.fillText('⏸ PAUSADO', w*0.5, h*0.5);
        }
        cx.fillStyle = 'rgba(0,230,255,0.5)';
        cx.font = '10px monospace';
        cx.textAlign = 'center';
        cx.fillText(paused ? 'Pulsa P para reanudar' : 'Pulsa P para pausar', w*0.5, h*0.9);
    }

    // Demo 5: tips — mostrar HUD simplificado
    function drawDemoTips(cx, w, h) {
        var t = tutDemoFrame;
        // Mostrar barra de tiempo
        var timeW = w * 0.6;
        var timeX = w * 0.2;
        cx.fillStyle = 'rgba(0,230,255,0.15)';
        cx.fillRect(timeX, h*0.22, timeW, 14);
        var fill = timeW * (0.4 + Math.sin(t*0.02)*0.3);
        var g = cx.createLinearGradient(timeX,0,timeX+fill,0);
        g.addColorStop(0,'#00e6ff'); g.addColorStop(1,'#ff2d78');
        cx.fillStyle = g;
        cx.fillRect(timeX, h*0.22, fill, 14);
        cx.strokeStyle = 'rgba(0,230,255,0.4)';
        cx.strokeRect(timeX, h*0.22, timeW, 14);
        cx.fillStyle = '#fff'; cx.font = '10px monospace'; cx.textAlign = 'center';
        cx.fillText('TIEMPO', w*0.5, h*0.19);
        // Enemigos y puntos
        var score = Math.floor(t * 0.5);
        cx.fillStyle = '#ffd700'; cx.font = 'bold 14px monospace'; cx.textAlign = 'right';
        cx.fillText('PUNTOS: ' + score, w*0.92, h*0.5);
        // Nave con corazones
        drawDemoShip(cx, w*0.5, h*0.72);
        cx.fillStyle = '#ff2d78'; cx.font = '14px monospace'; cx.textAlign = 'left';
        cx.fillText('♥ ♥ ♥', w*0.08, h*0.5);
        // +10s al matar
        var killCycle = t % 60;
        if (killCycle < 30) {
            var alpha = killCycle < 20 ? 1 : 1-(killCycle-20)/10;
            cx.fillStyle = 'rgba(0,255,100,' + alpha + ')';
            cx.font = 'bold 13px monospace'; cx.textAlign = 'center';
            cx.fillText('+10 seg  +5 pts', w*0.5, h*0.45 - killCycle*0.5);
        }
    }

    // ----------------------------------------------------------------
    //  SKINS
    // ----------------------------------------------------------------
    function loadProgress() {
        try {
            var p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
            progress.levelsCompleted = p.levelsCompleted || 0;
            progress.highScore       = p.highScore       || 0;
        } catch(e) {}
        // B2: restaurar personajes desbloqueados al cargar la página
        setTimeout(function() {
            var cards = document.querySelectorAll('.personaje-card');
            if (progress.levelsCompleted >= 3 && cards[1]) {
                cards[1].classList.remove('locked');
                var b1 = cards[1].querySelector('.char-badge');
                if (b1) { b1.textContent = 'DESBLOQUEADO'; b1.classList.add('unlocked'); }
                applyCharSprite(1);
            }
            if (progress.levelsCompleted >= 6 && cards[2]) {
                cards[2].classList.remove('locked');
                var b2 = cards[2].querySelector('.char-badge');
                if (b2) { b2.textContent = 'DESBLOQUEADO'; b2.classList.add('unlocked'); }
                applyCharSprite(2);
            }
        }, 200);
    }

    function saveProgress() {
        try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch(e) {}
    }

    function getUnlockedSkins() {
        return skinsData.filter(function(s) {
            return progress.levelsCompleted >= s.unlockLevel;
        }).map(function(s) { return s.id; });
    }

    function buildSkinsGrid() {
        var grid = document.getElementById('skinsGrid');
        if (!grid) return;
        grid.innerHTML = '';
        skinsData.forEach(function(s) {
            var item = document.createElement('div');
            item.className = 'skin-item locked';
            item.setAttribute('data-skin', s.id);
            // Miniatura: usar la imagen real de la skin
            item.innerHTML =
                '<img src="' + s.img + '" alt="' + s.name + '" style="width:44px;height:44px;object-fit:contain;image-rendering:pixelated;margin-bottom:4px;">' +
                '<div class="skin-label">' + s.name + '</div>';
            item.addEventListener('click', function() {
                if (!item.classList.contains('unlocked')) return;
                AudioEngine.sfxBtn();
                selectedSkin = s.id;
                // Recargar imagen del jugador si está en juego
                if (gameRunning && player) {
                    var skinObj = skinsData.filter(function(sk){ return sk.id === selectedSkin; })[0];
                    if (skinObj) player.src = skinObj.img;
                }
                updateSkinsGrid();
            });
            grid.appendChild(item);
        });
    }

    function updateSkinsGrid() {
        var unlocked = getUnlockedSkins();
        document.querySelectorAll('.skin-item').forEach(function(el) {
            var sid = el.getAttribute('data-skin');
            if (unlocked.containsElement(sid)) {
                el.classList.remove('locked');
                el.classList.add('unlocked');
            }
            el.classList.toggle('selected', sid === selectedSkin);
        });
    }

    // ----------------------------------------------------------------
    //  SCREENS
    // ----------------------------------------------------------------
    function showScreen(id) {
        AudioEngine.sfxBtn();
        // Detener demo del tutorial si estaba activa
        if (tutDemoAnim) { cancelAnimationFrame(tutDemoAnim); tutDemoAnim = null; }
        document.querySelectorAll('.screen').forEach(function(s) {
            s.classList.remove('active');
        });
        var target = document.getElementById(id);
        if (target) target.classList.add('active');
        if (id === 'menuPrincipal') {
            showBestScoresMenu();
            AudioEngine.stopMusic();
            setTimeout(function() { AudioEngine.startMusic('menu'); }, 200);
        }
        if (id === 'screenTutorial') {
            // Iniciar demo del primer paso al abrir el tutorial
            tutCurrentStep = 0;
            setTimeout(function() { startTutDemo(0); }, 100);
        }
    }

    // ----------------------------------------------------------------
    //  CHARACTER SELECTION
    // ----------------------------------------------------------------
    function selectCharacter(idx) {
        AudioEngine.sfxBtn();
        var cards = document.querySelectorAll('.personaje-card');
        // No permitir seleccionar si sigue bloqueado
        if (cards[idx] && cards[idx].classList.contains('locked')) return;
        // Quitar active de todas
        document.querySelectorAll('.personaje-card').forEach(function(c) {
            c.classList.remove('active');
        });
        if (cards[idx]) {
            cards[idx].classList.add('active');
            selectedChar = idx;
        }
        // Si es char 1 o 2, ocultar sección de skins (skins son solo para Vanguardia)
        var skinsSection = document.querySelector('.skins-section');
        if (skinsSection) {
            skinsSection.style.opacity = idx === 0 ? '1' : '0.3';
            skinsSection.style.pointerEvents = idx === 0 ? 'all' : 'none';
        }
    }

    // ----------------------------------------------------------------
    //  DIFICULTAD
    // ----------------------------------------------------------------
    function setDifficulty(diff) {
        AudioEngine.sfxBtn();
        currentDiff = diff;
        document.querySelectorAll('.diff-btn').forEach(function(b) {
            b.classList.toggle('active', b.getAttribute('data-diff') === diff);
        });
        var descs = {
            facil:   'Velocidad reducida, más tiempo.',
            normal:  'Velocidad normal, tiempo estándar.',
            dificil: 'Velocidad aumentada, poco tiempo.'
        };
        var el = document.getElementById('diffDesc');
        if (el) el.textContent = descs[diff];
    }

    // ----------------------------------------------------------------
    //  OPCIONES — listeners
    // ----------------------------------------------------------------
    function setupOptionListeners() {
        var toggleM = document.getElementById('toggleMusica');
        var toggleS = document.getElementById('toggleSfx');
        var volM    = document.getElementById('volMusica');
        var volS    = document.getElementById('volSfx');
        if (toggleM) toggleM.onchange = function() { AudioEngine.setMusicEnabled(this.checked); };
        if (toggleS) toggleS.onchange = function() { AudioEngine.setSfxEnabled(this.checked); };
        if (volM)    volM.oninput     = function() { AudioEngine.setMusicVol(this.value / 100 * 0.5); };
        if (volS)    volS.oninput     = function() { AudioEngine.setSfxVol(this.value / 100); };
    }

    // ----------------------------------------------------------------
    //  FULLSCREEN
    // ----------------------------------------------------------------
    function toggleFullscreen() {
        AudioEngine.sfxBtn();
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen && document.exitFullscreen();
        }
    }

    function showFullscreenPrompt() {
        var el = document.getElementById('fullscreenPrompt');
        if (el) el.classList.add('active');
        document.getElementById('btnFullscreen').onclick = function() {
            el.classList.remove('active');
            document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        };
        document.getElementById('btnSkipFs').onclick = function() {
            el.classList.remove('active');
        };
    }

    // ----------------------------------------------------------------
    //  EXIT GAME
    // ----------------------------------------------------------------
    function exitGame() {
        AudioEngine.sfxBtn();
        if (confirm('¿Seguro que quieres salir del juego?')) {
            window.close();
            document.body.innerHTML = '<div style="font-family:monospace;text-align:center;padding:80px;color:#00e6ff;font-size:24px;">Gracias por jugar NAVES 🚀</div>';
        }
    }

    function quitToMenu() {
        AudioEngine.sfxBtn();
        stopGame();
        showScreen('menuPrincipal');
        document.getElementById('menuPausa').classList.add('hidden');
    }

    // ----------------------------------------------------------------
    //  PRELOAD IMAGES
    // ----------------------------------------------------------------
    function preloadImages() {
        for (var i = 1; i <= 8; i++) {
            var ei = new Image(); ei.src = 'images/malo' + i + '.png';
            evilImages.animation[i-1] = ei;
            var bi = new Image(); bi.src = 'images/jefe' + i + '.png';
            bossImages.animation[i-1] = bi;
        }
        evilImages.killed.src   = 'images/malo_muerto.png';
        bossImages.killed.src   = 'images/jefe_muerto.png';
        bgMain = new Image(); bgMain.src = 'images/fondovertical.png';
        bgBoss = new Image(); bgBoss.src = 'images/fondovertical_jefe.png';
        playerShotImage   = new Image(); playerShotImage.src   = 'images/disparo_bueno.png';
        evilShotImage     = new Image(); evilShotImage.src     = 'images/Disparo_malo.png';
        playerKilledImage = new Image(); playerKilledImage.src = 'images/bueno_muerto.png';
        // Precargar imágenes de skins
        skinsData.forEach(function(s) {
            var img = new Image();
            img.src = s.img;
            skinImages[s.id] = img;
        });
    }

    // ----------------------------------------------------------------
    //  INICIAR / REINICIAR JUEGO
    // ----------------------------------------------------------------
    function startGame() {
        AudioEngine.resume();
        var nameInput = document.getElementById('inputNombre');
        playerName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim().toUpperCase() : 'COMANDANTE';

        canvas = document.getElementById('canvas');
        var hud = document.getElementById('hud');
        var hudH = hud ? hud.offsetHeight : 90;
        var isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        var canvasW, canvasH;
        if (isTouch) {
            // Móvil: ancho total, alto = ventana - HUD - botones táctiles
            canvasW = window.innerWidth;
            canvasH = window.innerHeight - hudH - 110;
        } else {
            // PC: ancho fijo 560px, alto = espacio disponible completo
            canvasW = 560;
            canvasH = window.innerHeight - hudH - 10;
        }
        canvasW = Math.max(canvasW, 280);
        canvasH = Math.max(canvasH, 300);
        canvas.width  = canvasW;
        canvas.height = canvasH;
        canvas.style.width  = canvasW + 'px';
        canvas.style.height = canvasH + 'px';
        ctx    = canvas.getContext('2d');
        buffer = document.createElement('canvas');
        buffer.width  = canvas.width;
        buffer.height = canvas.height;
        bufferctx = buffer.getContext('2d');

        // Aplicar dificultad
        var cfg = diffConfig[currentDiff];
        playerShotDelay = charConfigs[selectedChar].shotDelay * (currentDiff === 'dificil' ? 1.2 : 1);
        playerSpeed     = charConfigs[selectedChar].speed;

        // Aplicar dificultad a velocidad enemigos
        evilSpeed = cfg.evilSpeedMult;

        resetGameState();
        showScreen('screenJuego');
        updateHUD();
        startLevelTimer(cfg.timeLimit);

        AudioEngine.startMusic('game');

        if (!animId) { gameLoop(); }

        document.getElementById('hudNombre').textContent = playerName;
    }

    function restartGame() {
        AudioEngine.sfxBtn();
        stopGame();
        startGame();
    }

    function stopGame() {
        gameRunning = false;
        gamePaused  = false;
        if (levelTimerInterval) { clearInterval(levelTimerInterval); levelTimerInterval = null; }
        AudioEngine.stopMusic();
        playerShotsBuffer = [];
        evilShotsBuffer   = [];
        animId = null;
    }

    function resetGameState() {
        gameSessionId++;          // invalida todos los setTimeout de sesiones anteriores
        youLoose       = false;
        congratulations= false;
        gameRunning    = true;
        gamePaused     = false;
        totalEvils     = 7;
        evilCounter    = 1;
        currentLevel   = 1;
        bgOffset       = 0;
        shieldUsed     = false;
        shieldActive   = false;
        dashCooldown   = 0;
        dashDuration   = 0;
        isDashing      = false;
        playerShotsBuffer = [];
        evilShotsBuffer   = [];
        player = new Player(charConfigs[selectedChar].life, 0);
        createNewEvil();
        updateSkillIcons();
    }

    // ----------------------------------------------------------------
    //  GAME LOOP
    // ----------------------------------------------------------------
    function gameLoop() {
        if (!gameRunning) return;
        loop();
        animId = requestAnimFrame(gameLoop);
    }

    function loop() {
        if (!gamePaused) {
            update();
            draw();
        }
    }

    // ----------------------------------------------------------------
    //  PAUSA
    // ----------------------------------------------------------------
    function togglePause() {
        if (!gameRunning) return;
        AudioEngine.sfxPause();
        gamePaused = !gamePaused;
        var pauseMenu = document.getElementById('menuPausa');
        if (gamePaused) {
            pauseMenu.classList.remove('hidden');
            if (levelTimerInterval) { clearInterval(levelTimerInterval); levelTimerInterval = null; }
            AudioEngine.stopMusic();
        } else {
            pauseMenu.classList.add('hidden');
            startLevelTimer(levelTimer); // reanuda con tiempo restante
            AudioEngine.startMusic('game');
            if (!animId) { animId = requestAnimFrame(gameLoop); }
        }
    }

    // ----------------------------------------------------------------
    //  LEVEL TIMER
    // ----------------------------------------------------------------
    function startLevelTimer(seconds) {
        if (levelTimerInterval) clearInterval(levelTimerInterval);
        levelTimer = seconds;
        updateTimerHUD();
        levelTimerInterval = setInterval(function () {
            if (gamePaused || !gameRunning) return;
            levelTimer--;
            updateTimerHUD();
            if (levelTimer <= 0) {
                clearInterval(levelTimerInterval);
                levelTimerInterval = null;
                // Tiempo agotado: mata al jugador una vez
                if (!youLoose && !congratulations) {
                    player.killPlayer();
                }
            }
        }, 1000);
    }

    function updateTimerHUD() {
        var el = document.getElementById('timerValue');
        if (!el) return;
        el.textContent = levelTimer;
        el.classList.toggle('urgent', levelTimer <= 10);
    }

    // ----------------------------------------------------------------
    //  HUD
    // ----------------------------------------------------------------
    function updateHUD() {
        updateHearts();
        updateScore();
        updateLevelProgress();
        updateTimerHUD();
        updateSkillIcons();
    }

    function updateHearts() {
        var container = document.getElementById('hudHearts');
        if (!container) return;
        container.innerHTML = '';
        var maxLife = charConfigs[selectedChar].life;
        for (var i = 0; i < maxLife; i++) {
            var h = document.createElement('div');
            h.className = 'heart' + (i >= player.life ? ' lost' : '');
            h.textContent = '♥';
            container.appendChild(h);
        }
    }

    function updateScore() {
        var el = document.getElementById('hudScore');
        if (el) el.textContent = player.score;
    }

    function updateLevelProgress() {
        var filled  = 7 - totalEvils;
        var total   = 7;
        var pct     = (filled / total) * 100;
        var fill    = document.getElementById('levelProgressFill');
        var text    = document.getElementById('levelProgressText');
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = filled + '/' + total;
    }

    function updateBossHP() {
        var bar  = document.getElementById('bossHpBar');
        var fill = document.getElementById('bossBarInner');
        var txt  = document.getElementById('bossBarText');
        if (!bar) return;
        if (evil instanceof FinalBoss) {
            bar.classList.remove('hidden');
            var pct = (evil.life / finalBossLife) * 100;
            if (fill) fill.style.width = pct + '%';
            if (txt)  txt.textContent  = evil.life + '/' + finalBossLife;
        } else {
            bar.classList.add('hidden');
        }
    }

    function updateSkillIcons() {
        var dash   = document.getElementById('skillDash');
        var shield = document.getElementById('skillShield');
        if (dash) {
            dash.classList.toggle('ready', dashCooldown <= 0);
            dash.classList.toggle('cooldown', dashCooldown > 0);
        }
        if (shield) {
            shield.classList.toggle('ready', !shieldUsed);
            shield.classList.toggle('cooldown', shieldUsed);
        }
    }

    // ----------------------------------------------------------------
    //  PLAYER
    // ----------------------------------------------------------------
    function Player(life, score) {
        var settings = { marginBottom:0, defaultHeight:66 };
        var isTouch2 = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        // Móvil: jugador al 72% del alto; PC: al 82% del alto
        var yRatio = isTouch2 ? 0.72 : 0.78;
        settings.marginBottom = canvas.height - Math.floor(canvas.height * yRatio) - settings.defaultHeight;
        player = new Image();
        // A5 + A6: usar skin seleccionada para char 0, sprite generado para chars 1 y 2
        if (selectedChar === 1 && charSprites[1]) {
            player.src = charSprites[1];
        } else if (selectedChar === 2 && charSprites[2]) {
            player.src = charSprites[2];
        } else {
            var skinObj = skinsData.filter(function(s){ return s.id === selectedSkin; })[0];
            player.src = skinObj ? skinObj.img : 'images/bueno.png';
        }
        var targetPosX = (canvas.width / 2) - 30;
        var targetPosY = canvas.height - settings.defaultHeight - settings.marginBottom;
        player.posX  = targetPosX;
        player.posY  = targetPosY;
        // Reasignar posición cuando la imagen cargue (por si acaso)
        player.onload = function() {
            player.posX = targetPosX;
            player.posY = targetPosY;
        };
        player.life  = life;
        player.score = score;
        player.dead  = false;
        player.speed = playerSpeed;

        var shoot = function () {
            if (nextPlayerShot < now || now == 0) {
                var cfg = diffConfig[currentDiff];
                playerShot = new PlayerShot(player.posX + (player.width/2||30) - 5, player.posY);
                playerShot.add();
                AudioEngine.sfxShoot();
                // Efecto visual de disparo
                var canvasRect = canvas.getBoundingClientRect();
                Particles.shoot(
                    canvasRect.left + player.posX + 30,
                    canvasRect.top  + player.posY,
                    '#00e6ff'
                );
                now += playerShotDelay;
                nextPlayerShot = now + playerShotDelay;
            } else {
                now = new Date().getTime();
            }
        };

        player.doAnything = function () {
            if (player.dead) return;

            // Dash
            if (isDashing) {
                dashDuration--;
                player.posX += dashDir * 12;
                player.posX = Math.max(0, Math.min(canvas.width - 60, player.posX));
                if (dashDuration <= 0) { isDashing = false; }
            } else {
                if (keyPressed.left  && player.posX > 5) player.posX -= player.speed;
                if (keyPressed.right && player.posX < (canvas.width - 60 - 5)) player.posX += player.speed;
            }
            if (keyPressed.fire) shoot();

            // Cooldown dash
            if (dashCooldown > 0) {
                dashCooldown--;
                updateSkillIcons();
            }
        };

        player.killPlayer = function () {
            if (shieldActive) {
                // escudo absorbe el golpe
                shieldActive = false;
                AudioEngine.sfxShield();
                return;
            }
            AudioEngine.sfxPlayerHit();
            var canvasRect = canvas.getBoundingClientRect();
            Particles.burst(
                canvasRect.left + player.posX + 30,
                canvasRect.top  + player.posY + 30,
                '#ff2d78', 20, 4
            );
            if (this.life > 0) {
                this.dead = true;
                gameSessionId++;          // B4: invalida TODOS los timers del enemigo anterior
                // Limpiar buffers DESPUÉS de cambiar sesión
                evilShotsBuffer.length   = 0;
                playerShotsBuffer.length = 0;
                this.src = playerKilledImage.src;
                createNewEvil();  // el nuevo enemigo captura el gameSessionId ya incrementado
                setTimeout(function () {
                    var newLife = player.life - 1;
                    player = new Player(newLife, player.score);
                    updateHUD();
                    // Resetea timer en siguiente vida
                    startLevelTimer(diffConfig[currentDiff].timeLimit);
                }, 500);
            } else {
                saveFinalScore();
                youLoose = true;
                stopGame();
                setTimeout(function() { showGameOverScreen(); }, 800);
            }
        };
        return player;
    }

    // ----------------------------------------------------------------
    //  HABILIDADES JUGADOR
    // ----------------------------------------------------------------
    function activateDash() {
        if (dashCooldown > 0 || isDashing) return;
        AudioEngine.sfxDash();
        isDashing    = true;
        dashDir      = keyPressed.left ? -1 : 1;
        dashDuration = 10;
        dashCooldown = 120; // ~2s a 60fps
        updateSkillIcons();
    }

    function activateShield() {
        if (shieldUsed) return;
        AudioEngine.sfxShield();
        shieldActive = true;
        shieldUsed   = true;
        updateSkillIcons();
        // El escudo dura 3 segundos
        setTimeout(function() { shieldActive = false; }, 3000);
    }

    // ----------------------------------------------------------------
    //  SHOTS
    // ----------------------------------------------------------------
    function Shot(x, y, array, img) {
        this.posX  = x; this.posY = y;
        this.image = img; this.speed = shotSpeed;
        this.identifier = 0;
        this.add        = function () { array.push(this); };
        this.deleteShot = function (id) { arrayRemove(array, id); };
    }

    function PlayerShot(x, y) {
        Object.getPrototypeOf(PlayerShot.prototype).constructor.call(this, x, y, playerShotsBuffer, playerShotImage);
        this.isHittingEvil = function () {
            return (!evil.dead &&
                this.posX >= evil.posX && this.posX <= (evil.posX + evil.image.width) &&
                this.posY >= evil.posY && this.posY <= (evil.posY + evil.image.height));
        };
    }
    PlayerShot.prototype = Object.create(Shot.prototype);
    PlayerShot.prototype.constructor = PlayerShot;

    function EvilShot(x, y) {
        Object.getPrototypeOf(EvilShot.prototype).constructor.call(this, x, y, evilShotsBuffer, evilShotImage);
        this.isHittingPlayer = function () {
            return (this.posX >= player.posX && this.posX <= (player.posX + (player.width||60)) &&
                    this.posY >= player.posY && this.posY <= (player.posY + (player.height||66)));
        };
    }
    EvilShot.prototype = Object.create(Shot.prototype);
    EvilShot.prototype.constructor = EvilShot;

    // ----------------------------------------------------------------
    //  ENEMIES
    // ----------------------------------------------------------------
    function Enemy(life, shots, enemyImages) {
        this.image       = enemyImages.animation[0];
        this.imageNumber = 1;
        this.animation   = 0;
        this.posX  = getRandomNumber(canvas.width - 60);
        this.posY  = 0; // empieza en el borde superior del fondo
        this.life  = life  || evilLife;
        this.speed = evilSpeed;
        this.shots = shots || evilShots;
        this.dead  = false;

        var desplH = minHorizontalOffset + getRandomNumber(maxHorizontalOffset - minHorizontalOffset);
        this.minX  = getRandomNumber(canvas.width - desplH);
        this.maxX  = this.minX + desplH - 40;
        this.direction = 'D';

        this.kill = function () {
            this.dead = true;
            totalEvils--;
            this.image = enemyImages.killed;
            // B6: sumar 10 segundos al eliminar un enemigo
            levelTimer = Math.min(levelTimer + 10, diffConfig[currentDiff].timeLimit + 30);
            updateTimerHUD();
            // Efecto visual de muerte
            var cr = canvas.getBoundingClientRect();
            Particles.burst(
                cr.left + this.posX + 30,
                cr.top  + this.posY + 30,
                '#ff2d78', 24, 5
            );
            AudioEngine.sfxExplode();
            updateLevelProgress();
            verifyToCreateNewEvil();
        };

        this.update = function () {
            this.posY += this.goDownSpeed;
            // Movimiento horizontal
            if (this.direction === 'D') {
                if (this.posX <= this.maxX) { this.posX += this.speed; }
                else { this.direction = 'I'; this.posX -= this.speed; }
            } else {
                if (this.posX >= this.minX) { this.posX -= this.speed; }
                else { this.direction = 'D'; this.posX += this.speed; }
            }
            // Animación sprite
            this.animation++;
            if (this.animation > 5) {
                this.animation = 0;
                this.imageNumber = (this.imageNumber % 8) + 1;
                this.image = enemyImages.animation[this.imageNumber - 1];
            }
        };

        this.isOutOfScreen = function () { return this.posY > (canvas.height + 15); };

        var self = this;
        var mySession = gameSessionId;   // B4: captura ID de sesión al nacer el enemigo
        function shoot() {
            // B4: si cambió la sesión, este enemigo ya no existe — cancelar silenciosamente
            if (mySession !== gameSessionId) return;
            // Seguridad extra: no disparar si el juego terminó o está pausado
            if (!gameRunning || gamePaused || youLoose || congratulations) return;
            if (self.shots > 0 && !self.dead) {
                var d = new EvilShot(self.posX + (self.image.width/2||30) - 5, self.posY + (self.image.height||60));
                d.add();
                self.shots--;
                setTimeout(shoot, 800 + getRandomNumber(2200));
            }
        }
        setTimeout(shoot, 1000 + getRandomNumber(2500));
    }

    function Evil(vidas, disparos) {
        Object.getPrototypeOf(Evil.prototype).constructor.call(this, vidas, disparos, evilImages);
        this.goDownSpeed  = evilSpeed;
        this.pointsToKill = 5 + evilCounter;
    }
    Evil.prototype = Object.create(Enemy.prototype);
    Evil.prototype.constructor = Evil;

    function FinalBoss() {
        Object.getPrototypeOf(FinalBoss.prototype).constructor.call(this, finalBossLife, finalBossShots, bossImages);
        this.goDownSpeed  = evilSpeed / 2;
        this.pointsToKill = 20;
        this.bossPhase    = 1; // 1 = normal, 2 = enojado (<50% vida)
        this.horizontalDir = Math.random() > 0.5 ? 1 : -1;
        this.horizontalTimer = 0;
        AudioEngine.sfxBossAppear();
        // Cambiar a música del jefe
        setTimeout(function() { AudioEngine.startMusic('boss'); }, 800);

        var origUpdate = this.update.bind(this);
        var self = this;
        this.update = function () {
            origUpdate();
            // Movimiento horizontal aleatorio adicional
            self.horizontalTimer++;
            if (self.horizontalTimer > 60 + getRandomNumber(80)) {
                self.horizontalDir *= -1;
                self.horizontalTimer = 0;
            }
            self.posX += self.horizontalDir * (1.5 + self.posY / canvas.height * 2);
            self.posX = Math.max(0, Math.min(canvas.width - 80, self.posX));

            // Fase 2: más rápido con poca vida
            if (self.life <= finalBossLife / 2 && self.bossPhase === 1) {
                self.bossPhase   = 2;
                self.goDownSpeed = evilSpeed * 0.8;
                self.speed       = evilSpeed * 2;
            }
        };

        // Múltiples patrones de ataque del jefe
        var bossSession = gameSessionId;  // B4: capturar sesión del boss
        var bossAttackInterval = setInterval(function () {
            // B4: cancelar si la sesión cambió (jugador perdió vida)
            if (bossSession !== gameSessionId) {
                clearInterval(bossAttackInterval); return;
            }
            if (self.dead || youLoose || congratulations) {
                clearInterval(bossAttackInterval); return;
            }
            // Patrón 2: ráfaga de 3 disparos
            if (self.bossPhase === 2) {
                for (var i = 0; i < 3; i++) {
                    (function(j, sid) {
                        setTimeout(function() {
                            // B4: no disparar si la sesión ya cambió
                            if (sid !== gameSessionId) return;
                            if (self.dead || youLoose || congratulations) return;
                            var d = new EvilShot(self.posX + j * 25, self.posY + 60);
                            d.add();
                        }, j * 200);
                    })(i, bossSession);
                }
            }
        }, 3000);
    }
    FinalBoss.prototype = Object.create(Enemy.prototype);
    FinalBoss.prototype.constructor = FinalBoss;

    // ----------------------------------------------------------------
    //  CREATE / VERIFY EVIL
    // ----------------------------------------------------------------
    function createNewEvil() {
        if (totalEvils !== 1) {
            evil = new Evil(evilLife + evilCounter - 1, evilShots + evilCounter - 1);
        } else {
            evil = new FinalBoss();
        }
    }

    function verifyToCreateNewEvil() {
        var sessionSnap = gameSessionId;  // B4: capturar sesión actual
        if (totalEvils > 0) {
            setTimeout(function () {
                // B4: si el jugador perdió una vida mientras esperábamos, no crear enemigo
                if (sessionSnap !== gameSessionId) return;
                currentLevel++;
                updateNivelHUD();
                createNewEvil();
                evilCounter++;
                // Resetear escudo para el nuevo enemigo
                shieldUsed   = false;
                shieldActive = false;
                updateSkillIcons();
            }, getRandomNumber(3000));
        } else {
            setTimeout(function () {
                if (sessionSnap !== gameSessionId) return;
                saveFinalScore();
                congratulations = true;
                stopGame();
                checkUnlocks();
                showVictoryScreen();
            }, 2000);
        }
    }

    function updateNivelHUD() {
        var el = document.getElementById('hudNivel');
        if (el) el.textContent = currentLevel;
    }

    // ----------------------------------------------------------------
    //  COLISIONES
    // ----------------------------------------------------------------
    function isEvilHittingPlayer() {
        var pw = player.width  || 60, ph = player.height || 66;
        var ew = evil.image.width || 60, eh = evil.image.height || 60;
        var hitting = (
            (evil.posY + eh > player.posY && player.posY + ph >= evil.posY) &&
            ((player.posX >= evil.posX && player.posX <= evil.posX + ew) ||
             (player.posX + pw >= evil.posX && player.posX + pw <= evil.posX + ew))
        );
        // B5: si hay colisión y el escudo está activo, absórbela sin daño
        if (hitting && shieldActive) {
            shieldActive = false;
            shieldUsed   = true;
            AudioEngine.sfxShield();
            updateSkillIcons();
            var cr = canvas.getBoundingClientRect();
            Particles.burst(
                cr.left + player.posX + 30,
                cr.top  + player.posY + 30,
                '#00e6ff', 14, 3
            );
            return false; // no transmitir el daño
        }
        return hitting;
    }

    function checkCollisions(shot) {
        if (shot.isHittingEvil()) {
            AudioEngine.sfxHit();
            var canvasRect = canvas.getBoundingClientRect();
            Particles.burst(
                canvasRect.left + shot.posX,
                canvasRect.top  + shot.posY,
                '#ffd700', 8, 2
            );
            if (evil.life > 1) {
                evil.life--;
            } else {
                evil.kill();
                player.score += evil.pointsToKill;
                updateScore();
            }
            updateBossHP();
            shot.deleteShot(parseInt(shot.identifier));
            return false;
        }
        return true;
    }

    // ----------------------------------------------------------------
    //  UPDATE / DRAW
    // ----------------------------------------------------------------
    function update() {
        drawBackground();

        if (!player || !evil) return;

        // Dibujar jugador — si la imagen no ha cargado, dibujar rectángulo de placeholder
        if (player.complete && player.naturalWidth > 0) {
            bufferctx.drawImage(player, player.posX, player.posY, 60, 60);
        } else {
            bufferctx.fillStyle = '#00e6ff';
            bufferctx.fillRect(player.posX, player.posY, 60, 60);
        }
        // Dibujar enemigo
        if (evil.image.complete && evil.image.naturalWidth > 0) {
            bufferctx.drawImage(evil.image, evil.posX, evil.posY);
        } else {
            bufferctx.fillStyle = '#ff2d78';
            bufferctx.fillRect(evil.posX, evil.posY, 60, 60);
        }

        // Escudo visual
        if (shieldActive) {
            bufferctx.save();
            bufferctx.strokeStyle = 'rgba(0,230,255,0.7)';
            bufferctx.lineWidth   = 3;
            bufferctx.shadowBlur  = 16;
            bufferctx.shadowColor = '#00e6ff';
            bufferctx.beginPath();
            bufferctx.arc(player.posX + 30, player.posY + 33, 40, 0, Math.PI * 2);
            bufferctx.stroke();
            bufferctx.restore();
        }

        updateEvil();

        for (var j = 0; j < playerShotsBuffer.length; j++) {
            updatePlayerShot(playerShotsBuffer[j], j);
        }

        if (isEvilHittingPlayer()) {
            player.killPlayer();
        } else {
            for (var i = 0; i < evilShotsBuffer.length; i++) {
                updateEvilShot(evilShotsBuffer[i], i);
            }
        }

        playerAction();
        updateBossHP();
    }

    function draw() {
        ctx.drawImage(buffer, 0, 0);
    }

    function drawBackground() {
        var isBoss = (evil instanceof FinalBoss);
        bgOffset += 1;
        if (bgOffset >= canvas.height) bgOffset = 0;

        // === FONDO PROCEDURAL — azul espacial claro, sin cortes ===
        var grad = bufferctx.createLinearGradient(0, 0, 0, canvas.height);
        if (isBoss) {
            grad.addColorStop(0,   '#2a0018');
            grad.addColorStop(0.5, '#1a000f');
            grad.addColorStop(1,   '#300020');
        } else {
            grad.addColorStop(0,   '#062040');
            grad.addColorStop(0.5, '#0a2e55');
            grad.addColorStop(1,   '#062040');
        }
        bufferctx.fillStyle = grad;
        bufferctx.fillRect(0, 0, canvas.width, canvas.height);

        // Nebulosa central suave
        var cx = canvas.width * 0.5, cy = canvas.height * 0.4;
        var neb = bufferctx.createRadialGradient(cx, cy, 0, cx, cy, canvas.width * 0.75);
        if (isBoss) {
            neb.addColorStop(0,   'rgba(220,30,80,0.22)');
            neb.addColorStop(0.5, 'rgba(120,0,50,0.10)');
            neb.addColorStop(1,   'rgba(0,0,0,0)');
        } else {
            neb.addColorStop(0,   'rgba(0,140,230,0.20)');
            neb.addColorStop(0.5, 'rgba(0,80,160,0.10)');
            neb.addColorStop(1,   'rgba(0,0,0,0)');
        }
        bufferctx.fillStyle = neb;
        bufferctx.fillRect(0, 0, canvas.width, canvas.height);

        // Estrellas: 3 capas de parallax con parpadeo — SIN cortes
        var starLayers = [
            { count:60, speed:1.0,  size:1,   alpha:0.95 },
            { count:35, speed:0.55, size:1.5, alpha:0.70 },
            { count:18, speed:0.25, size:2.5, alpha:0.50 }
        ];
        starLayers.forEach(function(l) {
            for (var s = 0; s < l.count; s++) {
                var sx = (s * 97 + s * s * 3 + 17) % canvas.width;
                var rawY = (s * 137 + bgOffset * l.speed);
                var sy = ((rawY % canvas.height) + canvas.height) % canvas.height;
                var twinkle = 0.5 + 0.5 * Math.sin(s * 2.3 + bgOffset * 0.015);
                var a = l.alpha * (0.55 + 0.45 * twinkle);
                bufferctx.fillStyle = 'rgba(200,230,255,' + a + ')';
                bufferctx.beginPath();
                bufferctx.arc(sx, sy, l.size * 0.5, 0, Math.PI * 2);
                bufferctx.fill();
            }
        });
    }

    function updateEvil() {
        if (!evil.dead) {
            evil.update();
            // Cuando sale por abajo, reaparece desde arriba (sin morir)
            if (evil.isOutOfScreen()) {
                evil.posY = 0;
                evil.posX = getRandomNumber(canvas.width - 60);
                // Recalcular rango horizontal
                var desplH = minHorizontalOffset + getRandomNumber(maxHorizontalOffset - minHorizontalOffset);
                evil.minX = getRandomNumber(canvas.width - desplH);
                evil.maxX = evil.minX + desplH - 40;
            }
        }
    }

    function updatePlayerShot(pShot, id) {
        if (pShot) {
            pShot.identifier = id;
            if (checkCollisions(pShot)) {
                if (pShot.posY > 0) {
                    pShot.posY -= pShot.speed;
                    bufferctx.drawImage(pShot.image, pShot.posX, pShot.posY);
                } else {
                    pShot.deleteShot(parseInt(pShot.identifier));
                }
            }
        }
    }

    function updateEvilShot(evilShot, id) {
        if (evilShot) {
            evilShot.identifier = id;
            if (!evilShot.isHittingPlayer()) {
                if (evilShot.posY <= canvas.height) {
                    evilShot.posY += evilShot.speed;
                    // Dibujar disparo malo con tamaño fijo para que no sea enorme
                    bufferctx.drawImage(evilShot.image, evilShot.posX, evilShot.posY, 22, 22);
                } else {
                    evilShot.deleteShot(parseInt(evilShot.identifier));
                }
            } else {
                // B5: si el escudo está activo, absorbe el disparo sin dañar al jugador
                if (shieldActive) {
                    shieldActive = false;
                    shieldUsed   = true;
                    AudioEngine.sfxShield();
                    updateSkillIcons();
                    // Efecto visual de absorción
                    var cr = canvas.getBoundingClientRect();
                    Particles.burst(
                        cr.left + player.posX + 30,
                        cr.top  + player.posY + 30,
                        '#00e6ff', 14, 3
                    );
                } else {
                    player.killPlayer();
                }
                evilShot.deleteShot(parseInt(evilShot.identifier));
            }
        }
    }

    function playerAction() { player.doAnything(); }

    // ----------------------------------------------------------------
    //  CONTROLES TÁCTILES
    // ----------------------------------------------------------------
    var touchFireInterval = null;

    function touchStart(action) {
        AudioEngine.resume();
        if (!gameRunning || gamePaused) return;
        if (action === 'left')   { keyPressed.left  = true; }
        if (action === 'right')  { keyPressed.right = true; }
        if (action === 'fire') {
            keyPressed.fire = true;
            // Fuego continuo mientras se mantiene presionado
            if (!touchFireInterval) {
                touchFireInterval = setInterval(function() {
                    if (keyPressed.fire) {
                        // El disparo se maneja en doAnything via keyPressed.fire
                    } else {
                        clearInterval(touchFireInterval);
                        touchFireInterval = null;
                    }
                }, 50);
            }
        }
        if (action === 'dash')   { activateDash(); }
        if (action === 'shield') { activateShield(); }
    }

    function touchEnd(action) {
        if (action === 'left')  { keyPressed.left  = false; }
        if (action === 'right') { keyPressed.right = false; }
        if (action === 'fire')  {
            keyPressed.fire = false;
            if (touchFireInterval) {
                clearInterval(touchFireInterval);
                touchFireInterval = null;
            }
        }
    }

    function toggleTouchControls() {
        var tcL = document.getElementById('touchControlsLeft');
        var tcR = document.getElementById('touchControlsRight');
        if (tcL) tcL.classList.toggle('force-show');
        if (tcR) tcR.classList.toggle('force-show');
    }

    // ----------------------------------------------------------------
    //  GAME OVER / VICTORIA screens
    // ----------------------------------------------------------------
    function showGameOverScreen() {
        document.getElementById('goNombre').textContent = playerName;
        document.getElementById('goScore').textContent  = getTotalScore();
        showScreen('screenGameOver');
    }

    function showVictoryScreen() {
        document.getElementById('vicNombre').textContent = playerName;
        document.getElementById('vicScore').textContent  = getTotalScore();
        AudioEngine.sfxVictory();
        showScreen('screenVictoria');
    }

    function checkUnlocks() {
        // B1: incrementar correctamente y guardar
        progress.levelsCompleted++;
        if (getTotalScore() > progress.highScore) progress.highScore = getTotalScore();
        saveProgress();
        updateSkinsGrid();

        // B2: desbloquear personajes según niveles completados
        var cards = document.querySelectorAll('.personaje-card');
        // Interceptor se desbloquea al completar nivel 3
        if (progress.levelsCompleted >= 3 && cards[1]) {
            cards[1].classList.remove('locked');
            var badge1 = cards[1].querySelector('.char-badge');
            if (badge1) { badge1.textContent = 'DESBLOQUEADO'; badge1.classList.add('unlocked'); }
            applyCharSprite(1);  // mostrar sprite generado
        }
        // Destructor se desbloquea al completar nivel 6
        if (progress.levelsCompleted >= 6 && cards[2]) {
            cards[2].classList.remove('locked');
            var badge2 = cards[2].querySelector('.char-badge');
            if (badge2) { badge2.textContent = 'DESBLOQUEADO'; badge2.classList.add('unlocked'); }
            applyCharSprite(2);  // mostrar sprite generado
        }

        // Mensajes de desbloqueo en pantalla de victoria
        var unlockMsgs = [];
        var newSkins = skinsData.filter(function(s) {
            return s.unlockLevel === progress.levelsCompleted;
        });
        if (newSkins.length > 0) {
            unlockMsgs.push('🔓 Skin desbloqueada: ' + newSkins.map(function(s){ return s.name; }).join(', '));
        }
        if (progress.levelsCompleted === 3) unlockMsgs.push('🚀 Personaje INTERCEPTOR desbloqueado');
        if (progress.levelsCompleted === 6) unlockMsgs.push('💥 Personaje DESTRUCTOR desbloqueado');
        var el = document.getElementById('vicUnlocks');
        if (el) el.innerHTML = unlockMsgs.map(function(m){ return '<div>' + m + '</div>'; }).join('');
    }

    // ----------------------------------------------------------------
    //  SCORES
    // ----------------------------------------------------------------
    function getTotalScore() { return player.score + (player.life || 0) * 5; }

    function saveFinalScore() {
        // A3: formato "NOMBRE||DD/MM/YYYY HH:MM" para separar nombre de fecha sin ambigüedad
        var key = playerName + '||' + getFinalScoreDate();
        localStorage.setItem(key, getTotalScore());
        showBestScores();
        showBestScoresMenu();
        removeNoBestScores();
    }

    function getFinalScoreDate() {
        var d = new Date();
        return fillZero(d.getDate())+'/'+fillZero(d.getMonth()+1)+'/'+d.getFullYear()+' '+
               fillZero(d.getHours())+':'+fillZero(d.getMinutes());
    }

    // A3: extraer solo el nombre del key (antes del separador ||)
    function getNameFromKey(k) {
        var sep = k.indexOf('||');
        // Compatible con keys viejos (separador espacio) y nuevos (||)
        if (sep > -1) return k.substring(0, sep);
        var parts = k.split(' ');
        return parts[0] || k;
    }

    function fillZero(n) { return n < 10 ? '0' + n : n; }

    function getAllScores() {
        var all = [];
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k !== PROGRESS_KEY && k !== SKINS_KEY) {
                all.push(parseInt(localStorage.getItem(k)));
            }
        }
        return all;
    }

    function getBestScoreKeys() {
        var best = getAllScores().sort(function(a,b){return b-a;}).slice(0, totalBestScoresToShow);
        var keys = [];
        for (var j = 0; j < best.length; j++) {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k === PROGRESS_KEY || k === SKINS_KEY) continue;
                if (parseInt(localStorage.getItem(k)) === best[j] && !keys.containsElement(k)) {
                    keys.push(k);
                }
            }
        }
        return keys.slice(0, totalBestScoresToShow);
    }

    function showBestScores() {
        var list = document.getElementById('puntuaciones');
        if (!list) return;
        list.innerHTML = '';
        var keys = getBestScoreKeys();
        for (var i = 0; i < keys.length; i++) {
            // A3: mostrar nombre y puntos en el mismo <li>
            var li = document.createElement('li');
            if (i === 0) li.className = 'negrita';
            var nameSpan = document.createElement('span');
            nameSpan.className = 'score-name';
            nameSpan.textContent = getNameFromKey(keys[i]);
            var ptsSpan = document.createElement('span');
            ptsSpan.className = 'score-pts';
            ptsSpan.style.cssText = 'color:#00e6ff;font-weight:700;';
            ptsSpan.textContent = localStorage.getItem(keys[i]);
            li.appendChild(nameSpan);
            li.appendChild(ptsSpan);
            list.appendChild(li);
        }
    }

    function showBestScoresMenu() {
        var list = document.getElementById('puntuacionesMenu');
        if (!list) return;
        list.innerHTML = '';
        var keys = getBestScoreKeys();
        if (keys.length === 0) {
            var li = document.createElement('li');
            li.style.cssText = 'color:#5a7a9a;font-size:12px;justify-content:center;';
            li.textContent = 'Sin puntuaciones aún';
            list.appendChild(li);
            return;
        }
        keys.forEach(function(k, i) {
            var li = document.createElement('li');
            if (i === 0) li.className = 'first';
            var rank = document.createElement('span');
            rank.className = 'score-rank';
            rank.textContent = (i+1) + '.';
            var name = document.createElement('span');
            name.className = 'score-name';
            // A3: usar getNameFromKey para extraer solo el nombre
            name.textContent = getNameFromKey(k);
            var pts = document.createElement('span');
            pts.className = 'score-pts';
            pts.textContent = localStorage.getItem(k);
            li.appendChild(rank); li.appendChild(name); li.appendChild(pts);
            list.appendChild(li);
        });
    }

    function removeNoBestScores() {
        var best = getBestScoreKeys();
        var toRemove = [];
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k === PROGRESS_KEY || k === SKINS_KEY) continue;
            if (!best.containsElement(k)) toRemove.push(k);
        }
        toRemove.forEach(function(k) { localStorage.removeItem(k); });
    }

    function addListElement(list, content, className) {
        var el = document.createElement('li');
        if (className) el.setAttribute('class', className);
        el.innerHTML = content;
        list.appendChild(el);
    }

    // ----------------------------------------------------------------
    //  INPUT
    // ----------------------------------------------------------------
    function addListener(el, type, fn, bubbling) {
        bubbling = bubbling || false;
        if (window.addEventListener) el.addEventListener(type, fn, bubbling);
        else if (window.attachEvent)  el.attachEvent('on' + type, fn);
    }

    function keyDown(e) {
        // No capturar teclas cuando el foco está en un campo de texto
        var tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        var key = window.event ? e.keyCode : e.which;
        for (var k in keyMap) {
            if (key === keyMap[k]) {
                e.preventDefault();
                keyPressed[k] = true;
            }
        }
        if (key === keyMap.pause || key === keyMap.pauseEsc) {
            if (gameRunning) togglePause();
        }
        if (key === keyMap.dash   && gameRunning && !gamePaused) activateDash();
        if (key === keyMap.shield && gameRunning && !gamePaused) activateShield();
    }

    function keyUp(e) {
        var key = window.event ? e.keyCode : e.which;
        for (var k in keyMap) {
            if (key === keyMap[k]) {
                e.preventDefault();
                keyPressed[k] = false;
            }
        }
    }

    // ----------------------------------------------------------------
    //  UTILS
    // ----------------------------------------------------------------
    function getRandomNumber(range) { return Math.floor(Math.random() * range); }

    // ----------------------------------------------------------------
    //  PUBLIC API
    // ----------------------------------------------------------------
    function resizeGame() {
        var screenJuego = document.getElementById('screenJuego');
        if (!screenJuego || !screenJuego.classList.contains('active')) return;
        if (gameRunning) restartGame();
    }

    return {
        init: init,
        startGame: startGame,
        restartGame: restartGame,
        resizeGame: resizeGame,
        togglePause: togglePause,
        quitToMenu: quitToMenu,
        exitGame: exitGame,
        showScreen: showScreen,
        selectCharacter: selectCharacter,
        setDifficulty: setDifficulty,
        toggleFullscreen: toggleFullscreen,
        tutStep: tutStep,
        touchStart: touchStart,
        touchEnd: touchEnd,
        toggleTouchControls: toggleTouchControls
    };
})();

// ---- Arranque ----
window.addEventListener('load', function () {
    game.init();

    // Redimensionar canvas cuando cambia el tamaño de pantalla (ej: rotar móvil, DevTools)
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            game.resizeGame();
        }, 300);
    });
    // Mostrar prompt de pantalla completa al inicio
    setTimeout(function () {
        var el = document.getElementById('fullscreenPrompt');
        if (el) el.classList.add('active');
        document.getElementById('btnFullscreen').onclick = function () {
            el.classList.remove('active');
            document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        };
        document.getElementById('btnSkipFs').onclick = function () {
            el.classList.remove('active');
        };
    }, 600);
});
