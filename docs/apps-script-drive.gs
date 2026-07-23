/**
 * Google Apps Script — Drive upload proxy for the Gush Katif project.
 *
 * Lets the static site upload media into YOUR Google Drive folder without a
 * server. Files are made "anyone with the link can view" and the link is
 * returned to the site (stored in Firestore).
 *
 * DEPLOY:
 *   1. https://script.google.com  ->  New project. Paste this file.
 *   2. Set FOLDER_ID below to your target Drive folder id.
 *   3. Deploy > New deployment > type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   4. Copy the Web app URL into VITE_DRIVE_ENDPOINT (.env.local).
 *   5. Run once from the editor (any function) to grant Drive permission.
 */

// Folder id taken from your shared folder link:
// https://drive.google.com/drive/folders/16s9swCAt8AhTt439ccVuNlAv1cfe0h9v
var FOLDER_ID = '16s9swCAt8AhTt439ccVuNlAv1cfe0h9v';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var bytes = Utilities.base64Decode(body.dataBase64);
    var blob = Utilities.newBlob(bytes, body.mimeType || 'application/octet-stream', body.name || 'upload');

    var folder = DriveApp.getFolderById(FOLDER_ID);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return json({
      id: file.getId(),
      name: file.getName(),
      url: 'https://drive.google.com/file/d/' + file.getId() + '/view',
    });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function doGet() {
  return json({ ok: true, service: 'gush-katif-drive-upload' });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
