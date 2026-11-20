/** Collect and remap file IDs stored on nodes and background art. */

export function collectReferencedFileIds(workspaces = []) {
  const ids = new Set();
  for (const workspace of workspaces) {
    for (const node of workspace?.nodes || []) {
      if (node?.fileId) ids.add(node.fileId);
      if (node?.outputFileId) ids.add(node.outputFileId);
    }
    for (const image of workspace?.backgroundArt?.images || []) {
      if (image?.fileId) ids.add(image.fileId);
    }
  }
  return ids;
}

export function remapFileId(value, idMap) {
  if (!value || !idMap || !idMap[value]) return value;
  return idMap[value];
}

export function remapWorkspaceFileIds(workspace, idMap) {
  if (!workspace || !idMap || !Object.keys(idMap).length) return workspace;
  const nodes = Array.isArray(workspace.nodes)
    ? workspace.nodes.map((node) => {
        if (!node?.fileId && !node?.outputFileId) return node;
        return {
          ...node,
          ...(node.fileId ? { fileId: remapFileId(node.fileId, idMap) } : {}),
          ...(node.outputFileId ? { outputFileId: remapFileId(node.outputFileId, idMap) } : {}),
        };
      })
    : workspace.nodes;
  const images = workspace.backgroundArt?.images;
  const backgroundArt = Array.isArray(images)
    ? {
        ...workspace.backgroundArt,
        images: images.map((image) =>
          image?.fileId ? { ...image, fileId: remapFileId(image.fileId, idMap) } : image
        ),
      }
    : workspace.backgroundArt;
  return { ...workspace, nodes, backgroundArt };
}
