import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';

test('Consulta Estado RUT', async ({ page, request }) => {

  // Read the Excel file and extract values from column A
  const workbook = XLSX.readFile('test.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const nits = rows.slice(1).map(row => ({ nit: row[0], insumo: row[1] })).filter(val => !!val.nit);

  await page.goto('https://muisca.dian.gov.co/WebRutMuisca/DefConsultaEstadoRUT.faces');

  const data: any[][] = [["nit", "insumo", "razon social", "dv", "primer nombre", "primer apellido", "segundo apellido", "otros nombres", "estado"]];

  for (const { nit, insumo } of nits) {

    const siteKey = await page.locator('.cf-turnstile').getAttribute('data-sitekey')

    console.log(siteKey)

    const solverUrl = `http://127.0.0.1:5000/turnstile?url=${encodeURIComponent(page.url())}&sitekey=${siteKey}`;

    // LLamar al API del solver
    const solverResponse = await request.get(solverUrl);
    const solverData = await solverResponse.json();
    const taskId = solverData.task_id;
    console.log('Task ID:', taskId);



    // Hacer polling de la API de resultados hasta 10 intentos cada 5 segundos
    let solvedToken;
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts && !solvedToken; i++) {
      await page.waitForTimeout(10000);
      const resultUrl = `http://127.0.0.1:5000/result?id=${taskId}`;
      const resultResponse = await request.get(resultUrl);
      const resultData = await resultResponse.json();
      if (resultData.value) {
        solvedToken = resultData.value;
        console.log('Solved Token:', solvedToken);
        break;
      }
    }

    if (!solvedToken) {
      throw new Error('Captcha solving timed out.');
    }


    // Se usa la función callbackCaptcha para insertar el token
    await page.evaluate((token) => {
      // Validamos que el elemento con id "vistaConsultaEstadoRUT:formConsultaEstadoRUT:g-recaptcha-error" exista
      let errorElement = document.getElementById('vistaConsultaEstadoRUT:formConsultaEstadoRUT:g-recaptcha-error');
      if (!errorElement) {
        // Si no existe lo creamos
        errorElement = document.createElement('div');
        errorElement.id = 'vistaConsultaEstadoRUT:formConsultaEstadoRUT:g-recaptcha-error';
        const form = document.getElementById('vistaConsultaEstadoRUT:formConsultaEstadoRUT');
        if (form) {
          form.appendChild(errorElement);
        } else {
          document.body.appendChild(errorElement);
        }
      }
      // llamamos a la función callbackCaptcha que inyecta el token de solución del captcha
      if (typeof window['callbackCaptcha'] === 'function') {
        window['callbackCaptcha'](token);
      } else {
        console.error('callbackCaptcha is not defined.');
      }
    }, solvedToken);


    await page.locator('//input[@labeldisplay="Nit"]').fill(String(nit));
    await page.locator('//input[@onclick="return verificarCaptcha();"]').click()

    await page.screenshot({ path: `screenshots/evidence-${nit}.png` });


    // Define the two locators for expected data
    const locatorPersonaNatural = page.locator('//td[contains(text(), "label_primer_apellido")]');
    const locatorPeronsaJuridica = page.locator('//td[contains(text(), "label_dv")]');
    const locatorSinRegistro = page.locator('//td[contains(text(), "RUT")]');

    // Check which locator is visible and extract data accordingly.
    if (await locatorPersonaNatural.isVisible()) {
      const primerApellido = await page.locator('//td[contains(text(), "label_primer_apellido")]/following-sibling::td[1]').textContent();
      const estado = await page.locator('//td[contains(text(), "label_estado")]/following-sibling::td[1]').textContent();
      const segundoApellido = await page.locator('//td[contains(text(), "label_segundo_apellido")]/following-sibling::td[1]').textContent();
      const primerNombre = await page.locator('//td[contains(text(), "label_primer_nombre")]/following-sibling::td[1]').textContent();
      const otrosNombre = await page.locator('//td[contains(text(), "label_otros_nombres")]/following-sibling::td[1]').textContent();
      // Insert additional extraction logic for label_estado if needed.
      data.push([nit, insumo, '', '', primerNombre, primerApellido, segundoApellido, otrosNombre, estado]);
    } else if (await locatorPeronsaJuridica.isVisible()) {
      const dv = await page.locator('//td[contains(text(), "label_dv")]/following-sibling::td[1]').textContent();
      const razonSocial = await page.locator('//td[contains(text(), "label_razon_social")]/following-sibling::td[1]').textContent();
      const estado = await page.locator('//td[contains(text(), "label_estado")]/following-sibling::td[1]').textContent();
      data.push([nit, insumo, razonSocial, dv, '', '', '', '', estado]);
    } else if (await locatorSinRegistro.isVisible()) {
      data.push([nit, insumo, '', '', '', '', '', '', 'no esta inscrito en RUT']);
    } else {
      console.error(`None of the expected locators were visible for Nit ${nit}`);
    }


    await page.locator('//input[@onclick="limpiar();return false;"]').click()
  }


  // Write the data to a new Excel file
  const newWorkbook = XLSX.utils.book_new();
  const newSheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Sheet1');
  XLSX.writeFile(newWorkbook, 'ResultadoConsultaDian.xlsx');
});

