/** Read a File into a data: URL so a freshly-picked photo renders instantly in
 *  the diary, before the persisted backend copy is fetched on the next reload. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
