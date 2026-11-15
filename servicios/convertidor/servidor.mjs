// Convertidor Word → PDF. Recibe el .docx/.doc, lo convierte con LibreOffice y lo borra de inmediato.
// Solo atiende a usuarios con sesión de PascalPDF (se verifica el token con la función de cuentas).
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PUERTO = process.env.PORT || 8080;
const API = process.env.CUENTAS_API || 'https://dfzoqenxvpqkzkuakmli.supabase.co/functions/v1/pascalpdf-firma';
const ORIGENES = (process.env.ORIGENES || 'https://pascalia.lat,https://www.pascalia.lat').split(',');
const MAX = 20 * 1024 * 1024;
let enCurso = 0;

const cabeceras = (origen) => ({
    'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0],
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Nombre',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin'
});
const json = (res, c, cod, cuerpo) => { res.writeHead(cod, { ...c, 'Content-Type': 'application/json' }); res.end(JSON.stringify(cuerpo)); };

async function sesionValida(token) {
    if (!token || token.length > 500) return false;
    try {
        const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'cuenta', token }) });
        return r.ok;
    } catch { return false; }
}

function convertir(dir, archivo) {
    return new Promise((ok, mal) => {
        const p = spawn('soffice', ['--headless', '--norestore', '--nolockcheck', `-env:UserInstallation=file://${dir}/perfil`,
            '--convert-to', 'pdf:writer_pdf_Export', '--outdir', dir, archivo], { stdio: 'ignore' });
        const t = setTimeout(() => { p.kill('SIGKILL'); mal(new Error('tiempo')); }, 90000);
        p.on('exit', (c) => { clearTimeout(t); c === 0 ? ok() : mal(new Error('soffice ' + c)); });
        p.on('error', (e) => { clearTimeout(t); mal(e); });
    });
}

createServer(async (req, res) => {
    const c = cabeceras(req.headers.origin || '');
    if (req.method === 'OPTIONS') { res.writeHead(204, c); return res.end(); }
    if (req.method === 'GET' && req.url === '/salud') return json(res, c, 200, { ok: true });
    if (req.method !== 'POST' || req.url !== '/convertir') return json(res, c, 404, { error: 'No existe' });
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!(await sesionValida(token))) return json(res, c, 401, { error: 'Inicia sesión para convertir documentos.' });
    if (enCurso >= 3) return json(res, c, 503, { error: 'El convertidor está ocupado. Intenta de nuevo en un momento.' });
    const partes = []; let tam = 0, pasado = false;
    req.on('data', (d) => { tam += d.length; if (tam > MAX) pasado = true; else partes.push(d); });
    req.on('end', async () => {
        if (pasado) return json(res, c, 413, { error: 'El archivo supera 20 MB.' });
        const buf = Buffer.concat(partes);
        // .docx es un ZIP (PK); .doc es OLE (D0 CF 11 E0)
        const ext = buf[0] === 0x50 && buf[1] === 0x4b ? 'docx' : buf[0] === 0xd0 && buf[1] === 0xcf ? 'doc' : null;
        if (!ext) return json(res, c, 415, { error: 'El archivo no es un documento de Word.' });
        enCurso++;
        const dir = await mkdtemp(join(tmpdir(), 'conv-'));
        try {
            await writeFile(join(dir, 'documento.' + ext), buf);
            await convertir(dir, join(dir, 'documento.' + ext));
            const pdf = await readFile(join(dir, 'documento.pdf'));
            res.writeHead(200, { ...c, 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' });
            res.end(pdf);
        } catch (e) {
            console.error('fallo de conversión', e.message); // sin datos del documento
            json(res, c, 422, { error: 'No se pudo convertir este documento.' });
        } finally {
            enCurso--;
            rm(dir, { recursive: true, force: true }).catch(() => {});
        }
    });
}).listen(PUERTO, () => console.log('convertidor en', PUERTO));
