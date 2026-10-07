import { embedJsonIntoImage, extractJsonFromImage, getWatermarkCapacity } from './watermark.mjs';
const $ = id => document.getElementById(id);
let url;
const options = () => ({ strength: Number($('strength').value), redundancy: Number($('redundancy').value) });
async function capacity() {
  if (!$('source').files[0]) return;
  let image;
  try {
    image = await createImageBitmap($('source').files[0]);
    $('capacity').textContent = `${image.width} × ${image.height} / 인코딩된 payload 최대 ${getWatermarkCapacity(image.width, image.height, options())} bytes (압축 후 기준)`;
  } catch (error) { $('capacity').textContent = error.message; }
  finally { image?.close(); }
}
$('source').onchange = capacity; $('strength').onchange = capacity; $('redundancy').onchange = capacity;
async function run(button, action) {
  button.disabled = true; $('status').textContent = '처리 중…';
  try { await action(); $('status').textContent = '완료했습니다.'; }
  catch (error) { $('status').textContent = error.message; }
  finally { button.disabled = false; }
}
$('embed').onclick = () => run($('embed'), async () => {
  $('download').hidden = true;
  if (url) { URL.revokeObjectURL(url); url = undefined; }
  const blob = await embedJsonIntoImage($('source').files[0], JSON.parse($('json').value), options());
  url = URL.createObjectURL(blob); $('download').href = url; $('download').hidden = false;
});
$('extract').onclick = () => run($('extract'), async () => {
  $('output').textContent = '';
  $('output').textContent = JSON.stringify(await extractJsonFromImage($('encoded').files[0]), null, 2);
});
addEventListener('pagehide', () => { if (url) URL.revokeObjectURL(url); });
