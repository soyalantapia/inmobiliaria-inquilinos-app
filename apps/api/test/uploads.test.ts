import { describe, it, expect } from 'vitest';
import { resolverExtensionUpload } from '../src/routes/uploads.js';

// El bug reportado ("el comprobante del inquilino no se guarda con éxito") venía
// de que el cliente aceptaba cualquier image/* pero el server tenía una whitelist
// chica → una foto de celular con MIME image/jpg / image/heif daba 415. Estos
// tests fijan que ahora aceptamos las variantes reales de celular SIN abrir la
// puerta a svg/html.
describe('resolverExtensionUpload (whitelist de /uploads)', () => {
  it('acepta los MIME estándar', () => {
    expect(resolverExtensionUpload('image/jpeg', 'x.jpg')).toBe('.jpg');
    expect(resolverExtensionUpload('image/png', 'x.png')).toBe('.png');
    expect(resolverExtensionUpload('image/webp', 'x.webp')).toBe('.webp');
    expect(resolverExtensionUpload('image/gif', 'x.gif')).toBe('.gif');
    expect(resolverExtensionUpload('image/heic', 'x.heic')).toBe('.heic');
    expect(resolverExtensionUpload('application/pdf', 'x.pdf')).toBe('.pdf');
  });

  it('acepta las variantes reales de celular (la causa del bug)', () => {
    expect(resolverExtensionUpload('image/jpg', 'foto.jpg')).toBe('.jpg'); // Android
    expect(resolverExtensionUpload('image/pjpeg', 'foto.jpg')).toBe('.jpg');
    expect(resolverExtensionUpload('image/heif', 'IMG_0001.heic')).toBe('.heif'); // iPhone
    expect(resolverExtensionUpload('image/heic-sequence', 'IMG.heic')).toBe('.heic');
    expect(resolverExtensionUpload('image/heif-sequence', 'IMG.heic')).toBe('.heif');
  });

  it('matchea el MIME case-insensitive', () => {
    expect(resolverExtensionUpload('IMAGE/JPEG', 'x.JPG')).toBe('.jpg');
    expect(resolverExtensionUpload('Image/Png', 'x.png')).toBe('.png');
    expect(resolverExtensionUpload('  image/jpeg  ', 'x.jpg')).toBe('.jpg'); // con espacios
  });

  it('cae a la extensión del nombre cuando el MIME viene vacío o inútil', () => {
    expect(resolverExtensionUpload('', 'comprobante.jpg')).toBe('.jpg');
    expect(resolverExtensionUpload(undefined, 'comprobante.pdf')).toBe('.pdf');
    expect(resolverExtensionUpload('application/octet-stream', 'recibo.pdf')).toBe('.pdf');
    expect(resolverExtensionUpload('', 'foto.jpeg')).toBe('.jpg'); // .jpeg → .jpg
    expect(resolverExtensionUpload('', 'foto.HEIC')).toBe('.heic'); // extensión en mayúsculas
  });

  it('rechaza tipos no soportados y NUNCA guarda svg/html', () => {
    expect(resolverExtensionUpload('image/svg+xml', 'x.svg')).toBeNull();
    expect(resolverExtensionUpload('text/html', 'x.html')).toBeNull();
    expect(resolverExtensionUpload('', 'x.svg')).toBeNull();
    expect(resolverExtensionUpload('', 'malware.exe')).toBeNull();
    expect(resolverExtensionUpload('', '')).toBeNull();
    // Defensa clave: un svg renombrado a .jpg se guarda como .jpg (inerte, se
    // sirve como image/jpeg), jamás como svg → sin XSS al servir.
    expect(resolverExtensionUpload('image/svg+xml', 'trojan.jpg')).toBe('.jpg');
  });
});
