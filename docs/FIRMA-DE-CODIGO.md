# Firma de código — estado y cómo activarla

Fecha: 2026-10-29

## Situación actual

Los ejecutables se publican **sin firmar**. Consecuencias reales:

- Windows muestra **«Editor desconocido»** en el aviso de SmartScreen al ejecutar el
  instalador o la versión portable.
- SmartScreen puede tardar semanas en dejar de mostrar el aviso, aunque el archivo sea
  legítimo.
- No hay forma de verificar la integridad del binario más allá del `SHA256SUMS.txt` que
  publica el release.

Un certificado **autofirmado** no arregla nada: Windows lo sigue tratando como no
confiable. La firma tiene que venir de una CA reconocida.

## Lo que ya está preparado

`.github/workflows/release.yml` firma automáticamente en cuanto existan los secretos
`CSC_LINK` y `CSC_KEY_PASSWORD`:

- Con secretos: electron-builder firma los `.exe`, y el paso **Check signature** falla el
  workflow si `Get-AuthenticodeSignature` no devuelve `Valid`.
- Sin secretos: compila igual, avisa en el log (`Build SIN FIRMAR`) y lo dice en las
  notas del release.

No hay que tocar nada más del código cuando llegue el certificado.

## Opciones (precios orientativos, 2026)

| Opción | Coste típico | Ventajas | Inconvenientes |
|---|---|---|---|
| **Azure Trusted Signing** (Microsoft) | ~10 USD/mes | Firma desde CI sin hardware, integración con GitHub Actions, mantenimiento mínimo | Requiere cuenta de Azure y verificación de identidad de la organización (o individual, con historial) |
| **Certificado OV** (DigiCert, Sectigo, SSL.com…) | 200–400 USD/año | Estándar del sector | Desde 2023 la clave debe estar en un token/HSM: en CI hace falta firma en la nube (SSL.com eSigner, DigiCert KeyLocker) |
| **Certificado EV** | 400–700 USD/año | Reputación de SmartScreen inmediata | Hardware obligatorio, más caro |
| **Sin firma** (actual) | 0 | Nada que gestionar | «Editor desconocido» y SmartScreen |

Recomendación para este proyecto, que se distribuye por GitHub Releases: **Azure
Trusted Signing** si aceptas la dependencia de Azure; si no, un **OV con firma en la
nube**.

## Activación con un certificado en archivo (OV/EV)

1. Exporta el certificado como `.pfx` (o consigue el enlace de descarga del proveedor).
2. Codifícalo en base64:

   ```bash
   base64 -w0 certificate.pfx > certificate.b64     # Linux
   certutil -encode certificate.pfx certificate.b64 # Windows
   ```

3. Añade los secretos en GitHub → Settings → Secrets and variables → Actions:
   - `CSC_LINK` — el contenido base64 (o una URL `https://…` al `.pfx`).
   - `CSC_KEY_PASSWORD` — la contraseña del `.pfx`.
4. Etiqueta y publica. El workflow firma y verifica.

## Activación con Azure Trusted Signing

Requiere una cuenta de Trusted Signing, un *certificate profile* y un service principal
con el rol «Trusted Signing Certificate Profile Signer». En el workflow, antes de
empaquetar:

```yaml
- uses: azure/trusted-signing-action@v0
  with:
    azure-tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    azure-client-id: ${{ secrets.AZURE_CLIENT_ID }}
    azure-client-secret: ${{ secrets.AZURE_CLIENT_SECRET }}
    endpoint: https://eus.codesigning.azure.net/
    trusted-signing-account-name: <cuenta>
    certificate-profile-name: <perfil>
    files-folder: C:\nx\release
    files-folder-filter: exe
```

Con esta vía no se usan `CSC_LINK` ni `CSC_KEY_PASSWORD`: hay que quitar el `env` del paso
de empaquetado y ajustar el paso **Check signature** para que no exija `CSC_LINK`.

## Cómo comprobar una firma

```powershell
Get-AuthenticodeSignature .\NavegadorX-Setup-0.3.4-alpha.exe | Format-List Status, SignerCertificate
```

Estados esperados: `Valid` (firmado y con cadena correcta) o `NotSigned` (lo actual).

## Qué cuesta y qué no

- Firmar **no** elimina el aviso de SmartScreen el primer día con un OV: la reputación se
  construye con descargas. Con EV o con Trusted Signing el trato es mejor desde el
  principio.
- Un certificado caducado invalida las firmas antiguas a ojos de Windows; hay que renovar
  antes de la fecha de expiración.
- El `SHA256SUMS.txt` del release sigue siendo útil incluso con firma: permite detectar
  una descarga corrupta sin herramientas de Microsoft.
