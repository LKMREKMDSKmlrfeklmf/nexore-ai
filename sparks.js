/* sparks.js — Nexore AI background ember effect */
(function () {
  const canvas = document.getElementById('sparkCanvas');
  const ctx = canvas.getContext('2d');
  let W, H;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const POOL = 120;
  const particles = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  function spawn() {
    return {
      x: rand(W * 0.05, W * 0.95),
      y: H + rand(0, 14),
      vx: rand(-0.55, 0.55),
      vy: rand(-2.3, -0.85),
      life: 1,
      decay: rand(0.007, 0.02),
      size: rand(1, 3.4),
      hue: rand(22, 46),
      bright: rand(80, 100),
      flicker: rand(0, Math.PI * 2),
      flickerSpeed: rand(0.05, 0.14),
      drift: rand(-0.007, 0.007),
      streak: Math.random() < 0.18,
    };
  }

  for (let i = 0; i < POOL; i++) {
    const p = spawn();
    p.life = rand(0, 1);
    particles.push(p);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      p.x += p.vx + Math.sin(p.flicker) * 0.28;
      p.y += p.streak ? p.vy * 1.85 : p.vy;
      p.vx += p.drift;
      p.flicker += p.flickerSpeed;
      p.life -= p.decay;

      if (p.life <= 0 || p.y < -20) {
        particles[i] = spawn();
        continue;
      }

      const alpha = Math.pow(p.life, 1.4);
      const sz = p.size * p.life;

      // outer glow
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 4);
      grd.addColorStop(0, `hsla(${p.hue},100%,${p.bright}%,${alpha * 0.44})`);
      grd.addColorStop(1, `hsla(${p.hue},100%,60%,0)`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz * 4, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // core
      if (p.streak) {
        ctx.save();
        ctx.globalAlpha = alpha * 0.72;
        ctx.strokeStyle = `hsl(${p.hue},100%,96%)`;
        ctx.lineWidth = sz * 0.52;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx, p.y - sz * 5);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.3, sz * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(50,100%,98%,${alpha * 0.9})`;
        ctx.fill();
      }
    }

    requestAnimationFrame(draw);
  }

  draw();
})();
