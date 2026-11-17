import { migrateBackgroundArtLayers, nextLayerBelowNodes } from '@/lib/backgroundArtLayers';
import { newImageId, normalizeBackgroundArt } from '@/lib/backgroundArt';
import { putFileFromFileList } from '@/lib/mediaStore';

export async function addBackgroundImage(art, file, at = { x: 80, y: 80 }) {
  const bg = normalizeBackgroundArt(art);
  const meta = await putFileFromFileList(file);
  const layered = migrateBackgroundArtLayers(bg);
  const img = {
    id: newImageId(),
    fileId: meta.fileId,
    x: at.x,
    y: at.y,
    w: 240,
    h: 180,
    layer: nextLayerBelowNodes(layered),
  };
  return { ...layered, images: [...layered.images, img], tool: 'select' };
}