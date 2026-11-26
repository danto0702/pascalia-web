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
const MAX = 100 * 1024 * 1024;
const MAX_SIMULT = Number(process.env.SIMULTANEAS || 1); // LibreOffice usa mucha memoria: de a uno por defecto
const MAX_COLA = 40;
let enCurso = 0;
const cola = [];
// Turno para convertir: cada turno usa su propio perfil de LibreOffice, que se reutiliza (arranca más rápido y gasta menos)
const libres = Array.from({ length: MAX_SIMULT }, (_, i) => i);
function turno() {
    return new Promise((ok) => { if (libres.length) ok(libres.shift()); else cola.push(ok); });
}
function soltar(n) { const sig = cola.shift(); if (sig) sig(n); else libres.push(n); }

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

function convertir(dir, archivo, perfil) {
    return new Promise((ok, mal) => {
        const p = spawn('soffice', ['--headless', '--norestore', '--nolockcheck', '--nodefault', '--nofirststartwizard',
            `-env:UserInstallation=file://${tmpdir()}/perfil-${perfil}`,
            '--convert-to', 'pdf:writer_pdf_Export', '--outdir', dir, archivo], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, HOME: tmpdir() } });
        let err = '';
        p.stderr.on('data', (d) => { err = (err + d).slice(-300); });
        const t = setTimeout(() => { p.kill('SIGKILL'); mal(new Error('tiempo')); }, 300000);
        p.on('exit', (c) => { clearTimeout(t); c === 0 ? ok() : mal(new Error('soffice ' + c + ' ' + err.replace(/\s+/g, ' ').trim())); });
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
    if (cola.length >= MAX_COLA) return json(res, c, 503, { error: 'El convertidor está ocupado. Intenta de nuevo en un momento.' });
    const partes = []; let tam = 0, pasado = false;
    req.on('data', (d) => { tam += d.length; if (tam > MAX) pasado = true; else partes.push(d); });
    req.on('end', async () => {
        if (pasado) return json(res, c, 413, { error: 'El archivo supera 100 MB.' });
        const buf = Buffer.concat(partes);
        // .docx es un ZIP (PK); .doc es OLE (D0 CF 11 E0)
        const ext = buf[0] === 0x50 && buf[1] === 0x4b ? 'docx' : buf[0] === 0xd0 && buf[1] === 0xcf ? 'doc' : null;
        if (!ext) return json(res, c, 415, { error: 'El archivo no es un documento de Word.' });
        enCurso++;
        const dir = await mkdtemp(join(tmpdir(), 'conv-'));
        const n = await turno();
        try {
            await writeFile(join(dir, 'documento.' + ext), buf);
            let pdf = null;
            // Un reintento: si LibreOffice se cae, se borra su perfil y se intenta otra vez
            for (let intento = 1; intento <= 2 && !pdf; intento++) {
                try {
                    await convertir(dir, join(dir, 'documento.' + ext), n);
                    pdf = await readFile(join(dir, 'documento.pdf'));
                } catch (e) {
                    console.error(`fallo de conversión (intento ${intento})`, e.message);
                    if (intento === 2) throw e;
                    await rm(join(tmpdir(), 'perfil-' + n), { recursive: true, force: true }).catch(() => {});
                }
            }
            res.writeHead(200, { ...c, 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' });
            res.end(pdf);
        } catch (e) {
            json(res, c, 422, { error: 'No se pudo convertir este documento.' });
        } finally {
            enCurso--;
            soltar(n);
            rm(dir, { recursive: true, force: true }).catch(() => {});
        }
    });
}).listen(PUERTO, () => console.log('convertidor en', PUERTO));
