#!/usr/bin/env node
/**
 * Genera la landing page del root (out/index.html) inyectando datos de
 * `landing-data.json` en el template `landing.template.html`.
 *
 * Para actualizar las features de la landing: editás SOLO landing-data.json.
 * El próximo build regenera el HTML.
 */

const fs = require('node:fs');
const path = require('node:path');

const SCRIPTS_DIR = __dirname;
const ROOT = path.resolve(SCRIPTS_DIR, '..');
const OUT_DIR = path.join(ROOT, 'out');
// La landing rica va en /presentacion/ — el root del sitio es el picker simple.
const LANDING_DIR = path.join(OUT_DIR, 'presentacion');

const DATA_PATH = path.join(SCRIPTS_DIR, 'landing-data.json');
const TEMPLATE_PATH = path.join(SCRIPTS_DIR, 'landing.template.html');
const OUTPUT_PATH = path.join(LANDING_DIR, 'index.html');

// Escape HTML
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Render badges del hero
function renderBadges(badges) {
  return badges.map((b) => `<span class="badge">${esc(b)}</span>`).join('\n          ');
}

// Render stats
function renderStats(stats) {
  return stats
    .map(
      (s) => `
          <div class="stat">
            <div class="v">${esc(s.valor)}</div>
            <div class="l">${esc(s.label)}</div>
          </div>`,
    )
    .join('');
}

// Render una feature individual
function renderFeature(f) {
  const link = f.ruta
    ? `<a class="link" href="${esc(f.ruta)}">${esc(f.rutaLabel || 'Ver en la demo')}</a>`
    : '';
  return `
          <article class="feature">
            <h3>${esc(f.titulo)}</h3>
            <p>${esc(f.descripcion)}</p>
            ${link}
          </article>`;
}

// Render una sección completa (header + grid de features)
function renderSeccion(s) {
  const features = s.features.map(renderFeature).join('');
  return `
    <section id="${esc(s.id)}" class="featured">
      <div class="container">
        <div class="sec-header">
          <div class="sec-icon ic-${esc(s.color)}">${esc(s.icono)}</div>
          <h2>${esc(s.titulo)}</h2>
          <p>${esc(s.subtitulo)}</p>
        </div>
        <div class="features-grid">
          ${features}
        </div>
      </div>
    </section>`;
}

// Render nav links del navbar desktop — usa navTitulo (corto) si está disponible,
// si no cae al titulo largo. Solo las secciones de features, FAQ y Cambios
// se agregan aparte en el template.
function renderNavLinks(secciones) {
  return secciones
    .map((s) => `<a href="#${esc(s.id)}">${esc(s.navTitulo || s.titulo)}</a>`)
    .join('\n          ');
}

// Render changelog
function renderChangelog(changelog) {
  return changelog
    .map((r) => {
      const items = r.cambios
        .map((c) => `<li>${esc(c)}</li>`)
        .join('\n            ');
      return `
        <div class="release">
          <div class="release-header">
            <span class="release-v">${esc(r.version)}</span>
            <span class="release-title">${esc(r.titulo)}</span>
            <span class="release-date">${esc(r.fecha)}</span>
          </div>
          <ul>
            ${items}
          </ul>
        </div>`;
    })
    .join('');
}

// Render footer links — devuelve el bloque entero (incluido el <br>) o vacío si no hay
function renderFooterLinksBlock(links) {
  if (!links || links.length === 0) return '';
  const items = links
    .map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join(' · ');
  return `<br />${items}`;
}

// Render dolores de "El Problema"
function renderDolores(dolores) {
  return dolores
    .map(
      (d) => `
          <article class="dolor">
            <div class="dolor-icon">${esc(d.icono)}</div>
            <h3>${esc(d.titulo)}</h3>
            <p>${esc(d.descripcion)}</p>
          </article>`,
    )
    .join('');
}

// Render pasos de "Cómo funciona"
function renderPasos(pasos) {
  return pasos
    .map((p) => {
      const items = (p.detalles || [])
        .map((d) => `<li>${esc(d)}</li>`)
        .join('\n            ');
      return `
          <article class="paso">
            <div class="paso-numero">${esc(p.numero)}</div>
            <h3>${esc(p.titulo)}</h3>
            <p class="lead">${esc(p.descripcion)}</p>
            <ul>
            ${items}
            </ul>
          </article>`;
    })
    .join('');
}

// Render integraciones
function renderIntegraciones(items) {
  return items
    .map(
      (i) => `
          <div class="integracion">
            <div class="ig-icon">${esc(i.icono)}</div>
            <div class="ig-nombre">${esc(i.nombre)}</div>
            <div class="ig-desc">${esc(i.descripcion)}</div>
          </div>`,
    )
    .join('');
}

// Render comparativa antes/después como 2 columnas (todas las "antes" en la izq, todas las "después" en la derecha)
function renderAntesDespues(filas) {
  const antes = filas.map((f) => `<li>${esc(f.antes)}</li>`).join('\n            ');
  const despues = filas.map((f) => `<li>${esc(f.despues)}</li>`).join('\n            ');
  return `
        <div class="compare-col antes">
          <div class="compare-head">
            <span class="tag tag-rojo">Antes</span>
            <h3>Sin Llave</h3>
          </div>
          <ul>
            ${antes}
          </ul>
        </div>
        <div class="compare-col despues">
          <div class="compare-head">
            <span class="tag tag-violeta">Después</span>
            <h3>Con Llave</h3>
          </div>
          <ul>
            ${despues}
          </ul>
        </div>`;
}

// Render FAQ usando <details> nativo (accordion sin JS extra)
function renderFaq(items) {
  return items
    .map(
      (i) => `
          <details class="faq-item">
            <summary>${esc(i.pregunta)}</summary>
            <div class="faq-body">${esc(i.respuesta)}</div>
          </details>`,
    )
    .join('');
}

// Render drawer links — items para el menú mobile, en el mismo orden que la landing
function renderDrawerLinks(secciones) {
  const links = [
    { id: 'problema', label: '⚠️ El problema' },
    { id: 'antes-despues', label: '⚖️ Sin Llave / Con Llave' },
    { id: 'como-funciona', label: '🚀 Cómo funciona' },
    { id: 'funcionalidades', label: '✨ Funcionalidades' },
    ...secciones.map((s) => ({ id: s.id, label: `${s.icono} ${s.titulo}` })),
    { id: 'integraciones', label: '🔌 Integraciones' },
    { id: 'faq', label: '❓ Preguntas frecuentes' },
    { id: 'changelog', label: '📝 Cambios' },
  ];
  return links
    .map((l) => `<a class="drawer-link" href="#${esc(l.id)}">${esc(l.label)}</a>`)
    .join('\n      ');
}

function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`✗ No encontré ${DATA_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`✗ No encontré ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  // El título puede tener {{palabra}} marcando la palabra con gradiente.
  // También aceptamos un campo separado `highlight` por compatibilidad.
  function renderHeroTitulo(titulo, highlight) {
    if (titulo.includes('{{') && titulo.includes('}}')) {
      return titulo.replace(/\{\{([^}]+)\}\}/g, (_, palabra) => {
        return `<span class="grad">${esc(palabra)}</span>`;
      });
    }
    if (highlight && titulo.includes(highlight)) {
      return esc(titulo).replace(
        esc(highlight),
        `<span class="grad">${esc(highlight)}</span>`,
      );
    }
    return esc(titulo);
  }

  // Reemplazos
  const placeholders = {
    META_TITULO: esc(data.meta.titulo),
    META_DESCRIPCION: esc(data.meta.descripcion),
    META_VERSION: esc(data.meta.version),
    HERO_TAGLINE: esc(data.hero.tagline),
    HERO_TITULO_HTML: renderHeroTitulo(data.hero.titulo, data.hero.highlight),
    HERO_SUBTITULO: esc(data.hero.subtitulo),
    CTA_PROPIETARIO_TEXTO: esc(data.hero.ctaPropietario.texto),
    CTA_PROPIETARIO_HREF: esc(data.hero.ctaPropietario.href),
    CTA_INQUILINO_TEXTO: esc(data.hero.ctaInquilino.texto),
    CTA_INQUILINO_HREF: esc(data.hero.ctaInquilino.href),
    HERO_BADGES: renderBadges(data.hero.badges),
    STATS: renderStats(data.stats),
    NAV_LINKS: renderNavLinks(data.secciones),
    SECCIONES: data.secciones.map(renderSeccion).join('\n'),
    CHANGELOG: renderChangelog(data.changelog),
    FOOTER_CREDITOS: esc(data.footer.creditos),
    FOOTER_LINKS_BLOCK: renderFooterLinksBlock(data.footer.links),
    // Nueva sección "Problema"
    PROBLEMA_TAG: esc(data.problema.tag),
    PROBLEMA_TITULO: esc(data.problema.titulo),
    PROBLEMA_SUBTITULO: esc(data.problema.subtitulo),
    PROBLEMA_DOLORES: renderDolores(data.problema.dolores),
    // Nuevas secciones
    COMO_FUNCIONA_TITULO: esc(data.comoFunciona.titulo),
    COMO_FUNCIONA_SUBTITULO: esc(data.comoFunciona.subtitulo),
    COMO_FUNCIONA_PASOS: renderPasos(data.comoFunciona.pasos),
    INTEGRACIONES_TITULO: esc(data.integraciones.titulo),
    INTEGRACIONES_SUBTITULO: esc(data.integraciones.subtitulo),
    INTEGRACIONES_ITEMS: renderIntegraciones(data.integraciones.items),
    ANTES_DESPUES_TITULO: esc(data.antesDespues.titulo),
    ANTES_DESPUES_SUBTITULO: esc(data.antesDespues.subtitulo),
    ANTES_DESPUES_COLS: renderAntesDespues(data.antesDespues.filas),
    FAQ_TITULO: esc(data.faq.titulo),
    FAQ_SUBTITULO: esc(data.faq.subtitulo),
    FAQ_ITEMS: renderFaq(data.faq.items),
    DRAWER_LINKS: renderDrawerLinks(data.secciones),
  };

  for (const [key, value] of Object.entries(placeholders)) {
    html = html.split(`{{${key}}}`).join(value);
  }

  // Detectar placeholders no resueltos
  const restantes = html.match(/\{\{[A-Z_]+\}\}/g);
  if (restantes) {
    console.warn(`⚠ Placeholders sin resolver: ${[...new Set(restantes)].join(', ')}`);
  }

  if (!fs.existsSync(LANDING_DIR)) {
    fs.mkdirSync(LANDING_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_PATH, html, 'utf8');

  const totalFeatures = data.secciones.reduce((acc, s) => acc + s.features.length, 0);
  console.log(`✓ Landing generada en ${path.relative(ROOT, OUTPUT_PATH)}`);
  console.log(
    `  ${data.problema.dolores.length} dolores · ${data.comoFunciona.pasos.length} pasos · ` +
      `${data.secciones.length} secciones · ${totalFeatures} features · ` +
      `${data.integraciones.items.length} integraciones · ${data.faq.items.length} FAQ · ` +
      `${data.changelog.length} releases`,
  );
}

main();
