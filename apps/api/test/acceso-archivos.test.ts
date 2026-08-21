/**
 * T-72 · `GET /uploads` autorizaba por tenant, no por dueño del archivo.
 *
 * Cualquier inquilino, co-inquilino o profesional con link mágico que conociera el nombre leía
 * CUALQUIER archivo de esa inmobiliaria: el comprobante del 3°B, el DNI de otro contrato, el
 * recibo de sueldo de un garante ajeno, el extracto bancario de la administradora. Lo único que
 * lo tapaba es que el nombre es un `randomUUID()` — oscuridad, no autorización: la URL viaja en
 * el `<img src>`, queda en el historial del browser y se reenvía como cualquier link.
 *
 * LA REGLA TIENE DOS VÍAS y alcanza con una: lo subiste vos, o está colgado de una fila de tu
 * ámbito. La segunda es la que salva a **todo lo histórico** sin backfill: la tabla de dueños
 * nace vacía, pero un comprobante de marzo sí tiene su `Pago` con `contratoId` — la misma fila
 * que el front ya lee para armar el `<img src>`.
 *
 * LO QUE FIJA ESTE TEST es que la vía 2 **no se auto-anula**. Sería un agujero si alguien
 * pudiera enganchar una URL ajena a una fila propia y auto-autorizarse; por eso adjuntar exige
 * exactamente lo mismo que leer.
 *
 * Test puro: el cliente de base es un doble.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const dbFalso = {
  archivoSubido: { findUnique: vi.fn() },
  coInquilino: { findUnique: vi.fn() },
  pago: { count: vi.fn() },
  boletaServicio: { count: vi.fn() },
  reclamo: { count: vi.fn() },
  documentoContrato: { count: vi.fn() },
  comprobante: { count: vi.fn() },
  inquilino: { count: vi.fn() },
  documento: { count: vi.fn() },
  visitaProfesional: { count: vi.fn() },
};
vi.mock('../src/db.js', () => ({ prisma: dbFalso }));

const { puedeLeerArchivo, puedeAdjuntar } = await import('../src/lib/acceso-archivos.js');

const TENANT = 'inm_1';
const AJENO = '/uploads/inm_1/de-otra-persona.pdf';
const MIO = '/uploads/inm_1/mi-comprobante.pdf';

const inquilino = { kind: 'inquilino' as const, tenant: TENANT, inquilinoId: 'inq_A', contratoId: 'cnt_A' };
const profesional = { kind: 'profesional' as const, tenant: TENANT, visitaId: 'vis_1' };
const panel = { kind: 'usuario' as const, tenant: TENANT, userId: 'usr_1' };

/** Por defecto: no hay dueño registrado y ninguna fila lo referencia. */
function nadaEncontrado() {
  dbFalso.archivoSubido.findUnique.mockResolvedValue(null);
  const tablas = ['pago', 'boletaServicio', 'reclamo', 'documentoContrato', 'comprobante', 'inquilino', 'documento', 'visitaProfesional'] as const;
  for (const t of tablas) dbFalso[t].count.mockResolvedValue(0);
  dbFalso.coInquilino.findUnique.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  nadaEncontrado();
  // Los tests de ADJUNTAR corren con el interruptor en `on`: es el estado que se quiere fijar.
  // El default de producción es `log` y eso lo cubre el bloque del final.
  process.env.UPLOADS_AMBITO = 'on';
});

afterEach(() => {
  delete process.env.UPLOADS_AMBITO;
});

describe('T-72 — el agujero', () => {
  it('un inquilino NO lee un archivo ajeno del mismo tenant', async () => {
    // Con el bug: alcanzaba con que el tenant coincidiera.
    expect(await puedeLeerArchivo(AJENO, inquilino)).toBe(false);
  });

  it('un profesional con link mágico tampoco', async () => {
    expect(await puedeLeerArchivo(AJENO, profesional)).toBe(false);
  });
});

describe('T-72 — vía 1: lo subiste vos', () => {
  it('el que lo subió lo lee, aunque todavía no lo haya adjuntado a nada', async () => {
    // La ventana entre POST /uploads y el request que persiste la URL es real: la PWA
    // previsualiza el comprobante ANTES de informar el pago. Sin esta vía se rompe.
    dbFalso.archivoSubido.findUnique.mockResolvedValue({
      inmobiliariaId: TENANT, subidoPorKind: 'INQUILINO', subidoPorId: 'inq_A',
    });
    expect(await puedeLeerArchivo(MIO, inquilino)).toBe(true);
  });

  it('la fila de dueño de OTRO no te sirve', async () => {
    dbFalso.archivoSubido.findUnique.mockResolvedValue({
      inmobiliariaId: TENANT, subidoPorKind: 'INQUILINO', subidoPorId: 'inq_B',
    });
    expect(await puedeLeerArchivo(AJENO, inquilino)).toBe(false);
  });

  it('ni la de otro KIND con el mismo id', async () => {
    dbFalso.archivoSubido.findUnique.mockResolvedValue({
      inmobiliariaId: TENANT, subidoPorKind: 'CO_INQUILINO', subidoPorId: 'inq_A',
    });
    expect(await puedeLeerArchivo(AJENO, inquilino)).toBe(false);
  });

  it('ni una fila de otro tenant', async () => {
    dbFalso.archivoSubido.findUnique.mockResolvedValue({
      inmobiliariaId: 'inm_2', subidoPorKind: 'INQUILINO', subidoPorId: 'inq_A',
    });
    expect(await puedeLeerArchivo(AJENO, inquilino)).toBe(false);
  });
});

describe('T-72 — vía 2: lo histórico, sin backfill', () => {
  it('un comprobante de marzo se lee porque su Pago es de MI contrato', async () => {
    dbFalso.pago.count.mockResolvedValue(1);
    expect(await puedeLeerArchivo(MIO, inquilino)).toBe(true);
    expect(dbFalso.pago.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ contratoId: 'cnt_A' }) }),
    );
  });

  it('el profesional ve la foto del reclamo de SU visita', async () => {
    dbFalso.visitaProfesional.count.mockResolvedValue(1);
    expect(await puedeLeerArchivo(MIO, profesional)).toBe(true);
  });

  it('un inquilino SIN contrato sólo llega a lo suyo como persona', async () => {
    const sinContrato = { ...inquilino, contratoId: null };
    dbFalso.documento.count.mockResolvedValue(1);
    expect(await puedeLeerArchivo(MIO, sinContrato)).toBe(true);
    // Y no se consultó nada por contrato, porque no tiene.
    expect(dbFalso.pago.count).not.toHaveBeenCalled();
  });
});

describe('T-72 — el panel no cambia', () => {
  it('un usuario de la inmobiliaria sigue viendo su cartera', async () => {
    expect(await puedeLeerArchivo(AJENO, panel)).toBe(true);
    // Y sin pagar ninguna consulta extra.
    expect(dbFalso.archivoSubido.findUnique).not.toHaveBeenCalled();
  });
});

describe('T-72 — adjuntar exige lo mismo que leer (la vía 2 no se auto-anula)', () => {
  const jwtInquilino = {
    kind: 'inquilino' as const, inmobiliariaId: TENANT, inquilinoId: 'inq_A', contratoId: 'cnt_A',
  };

  it('NO podés enganchar a una fila tuya una URL que no podés leer', async () => {
    // ESTE es el ataque: con la URL de la víctima, POST /mis-documentos y me auto-autorizo.
    expect(await puedeAdjuntar(AJENO, jwtInquilino)).toBe(false);
  });

  it('sí podés adjuntar lo que acabás de subir', async () => {
    dbFalso.archivoSubido.findUnique.mockResolvedValue({
      inmobiliariaId: TENANT, subidoPorKind: 'INQUILINO', subidoPorId: 'inq_A',
    });
    expect(await puedeAdjuntar(MIO, jwtInquilino)).toBe(true);
  });

  it('limpiar el campo (url vacía o null) no es adjuntar', async () => {
    for (const v of [null, undefined, '']) expect(await puedeAdjuntar(v, jwtInquilino)).toBe(true);
  });

  it('sin poder identificar al actor, se deniega: falla del lado seguro', async () => {
    const nadie = { inmobiliariaId: TENANT, contratoId: null, esCoInquilino: false, inquilinoId: null, coInquilinoId: null };
    expect(await puedeAdjuntar(AJENO, nadie)).toBe(false);
  });

  it('al co-inquilino se le lee el contrato de la BASE, no del token', async () => {
    // El guard de /uploads revalida el estado del co-inquilino pero NO su contratoId, así que
    // tomarlo del JWT dejaría el ámbito para leer más laxo que el de adjuntar.
    dbFalso.coInquilino.findUnique.mockResolvedValue({ contratoId: 'cnt_REAL' });
    dbFalso.pago.count.mockResolvedValue(0);
    const jwtCo = {
      kind: 'co-inquilino', inmobiliariaId: TENANT, coInquilinoId: 'co_1',
      contratoId: 'cnt_MENTIRA', permiso: 'COMPLETO',
    } as never;
    await puedeAdjuntar(AJENO, jwtCo);
    expect(dbFalso.coInquilino.findUnique).toHaveBeenCalled();
    expect(dbFalso.pago.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ contratoId: 'cnt_REAL' }) }),
    );
  });
});

describe('T-72 — el interruptor es UNO SOLO para leer y para adjuntar', () => {
  const jwtInquilino = {
    kind: 'inquilino' as const, inmobiliariaId: TENANT, inquilinoId: 'inq_A', contratoId: 'cnt_A',
  };

  it('en `log` (el default de producción) adjuntar NO se bloquea', async () => {
    // Es lo que hace imposible el estado peligroso intermedio: si la lectura no bloquea,
    // la escritura tampoco, así que nadie puede "prepararse" un enganche mientras tanto.
    process.env.UPLOADS_AMBITO = 'log';
    expect(await puedeAdjuntar(AJENO, jwtInquilino)).toBe(true);
  });

  it('en `off` tampoco', async () => {
    process.env.UPLOADS_AMBITO = 'off';
    expect(await puedeAdjuntar(AJENO, jwtInquilino)).toBe(true);
  });

  it('sin la variable puesta, el default es `log`: no bloquea', async () => {
    delete process.env.UPLOADS_AMBITO;
    expect(await puedeAdjuntar(AJENO, jwtInquilino)).toBe(true);
  });

  it('y con `on` sí bloquea', async () => {
    process.env.UPLOADS_AMBITO = 'on';
    expect(await puedeAdjuntar(AJENO, jwtInquilino)).toBe(false);
  });

  it('el guard de LECTURA es independiente del modo: siempre da su veredicto', async () => {
    // El modo lo consulta el handler, no la regla. Así el modo `log` puede registrar QUÉ
    // habría bloqueado, que es la razón de ser de esa etapa.
    process.env.UPLOADS_AMBITO = 'log';
    expect(await puedeLeerArchivo(AJENO, inquilino)).toBe(false);
  });
});
