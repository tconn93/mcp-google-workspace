/**
 * Google Drive tools
 * All functions are called by the dispatcher in Code.gs
 */

// ---------------------------------------------------------------------------
// drive_search
// Params: { query: string, maxResults?: number }
// See: https://developers.google.com/drive/api/guides/search-files
// ---------------------------------------------------------------------------
function driveSearch(params) {
  if (!params.query) throw new Error('query is required');
  const maxResults = Math.min(params.maxResults || 10, 50);

  const files = DriveApp.searchFiles(params.query);
  const results = [];

  while (files.hasNext() && results.length < maxResults) {
    const file = files.next();
    results.push(fileToObject(file));
  }

  return results;
}

// ---------------------------------------------------------------------------
// drive_get_file
// Params: { fileId: string }
// ---------------------------------------------------------------------------
function driveGetFile(params) {
  if (!params.fileId) throw new Error('fileId is required');

  const file = DriveApp.getFileById(params.fileId);
  return fileToObject(file);
}

// ---------------------------------------------------------------------------
// drive_export_file
// Exports a Google Workspace file (Doc, Sheet, etc.) to a given MIME type,
// or returns the raw content of a binary file as base64.
// Params: {
//   fileId: string,
//   mimeType?: string   // e.g. "text/plain", "application/pdf". Defaults to text/plain.
// }
// ---------------------------------------------------------------------------
function driveExportFile(params) {
  if (!params.fileId) throw new Error('fileId is required');

  const targetMime = params.mimeType || 'text/plain';
  const file = DriveApp.getFileById(params.fileId);
  const nativeMime = file.getMimeType();

  // Google Workspace native types need to be exported
  const googleTypes = [
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'application/vnd.google-apps.drawing'
  ];

  var content;
  if (googleTypes.indexOf(nativeMime) !== -1) {
    const token = ScriptApp.getOAuthToken();
    const url = 'https://www.googleapis.com/drive/v3/files/' + params.fileId +
                '/export?mimeType=' + encodeURIComponent(targetMime);
    const response = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('Drive export failed: ' + response.getContentText());
    }
    content = response.getContentText();
  } else {
    const blob = file.getBlob();
    content = Utilities.base64Encode(blob.getBytes());
    return { fileId: params.fileId, name: file.getName(), mimeType: nativeMime, encoding: 'base64', content: content };
  }

  return { fileId: params.fileId, name: file.getName(), mimeType: targetMime, encoding: 'utf8', content: content };
}

// ---------------------------------------------------------------------------
// drive_list_folder
// Lists the contents of a Drive folder.
// Params: { folderId: string, maxResults?: number }
// ---------------------------------------------------------------------------
function driveListFolder(params) {
  if (!params.folderId) throw new Error('folderId is required');
  const maxResults = Math.min(params.maxResults || 50, 100);

  var folder = params.folderId === 'root'
    ? DriveApp.getRootFolder()
    : DriveApp.getFolderById(params.folderId);
  if (!folder) throw new Error('Folder not found: ' + params.folderId);

  var items = [];

  var subFolders = folder.getFolders();
  while (subFolders.hasNext() && items.length < maxResults) {
    var f = subFolders.next();
    items.push({ id: f.getId(), name: f.getName(), type: 'folder',
      mimeType: 'application/vnd.google-apps.folder', url: f.getUrl(),
      modifiedAt: f.getLastUpdated().toISOString() });
  }

  var files = folder.getFiles();
  while (files.hasNext() && items.length < maxResults) {
    var file = files.next();
    items.push({ id: file.getId(), name: file.getName(), type: 'file',
      mimeType: file.getMimeType(), size: file.getSize(), url: file.getUrl(),
      modifiedAt: file.getLastUpdated().toISOString() });
  }

  return { folderId: folder.getId(), name: folder.getName(), itemCount: items.length, items: items };
}

// ---------------------------------------------------------------------------
// drive_read_doc_markdown
// Converts a Google Doc to Markdown (headings, bold, italic, lists, tables).
// Params: { fileId: string }
// ---------------------------------------------------------------------------
function driveReadDocMarkdown(params) {
  if (!params.fileId) throw new Error('fileId is required');

  const doc  = DocumentApp.openById(params.fileId);
  const body = doc.getBody();
  var lines  = [];

  for (var i = 0; i < body.getNumChildren(); i++) {
    var child = body.getChild(i);
    var type  = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      var para    = child.asParagraph();
      var heading = para.getHeading();
      var text    = paraToMd(para);
      var prefix  = '';
      if      (heading === DocumentApp.ParagraphHeading.HEADING1) prefix = '# ';
      else if (heading === DocumentApp.ParagraphHeading.HEADING2) prefix = '## ';
      else if (heading === DocumentApp.ParagraphHeading.HEADING3) prefix = '### ';
      else if (heading === DocumentApp.ParagraphHeading.HEADING4) prefix = '#### ';
      lines.push(text.trim() === '' ? '' : prefix + text);

    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      var item      = child.asListItem();
      var indent    = new Array(item.getNestingLevel() + 1).join('  ');
      var glyphType = item.getGlyphType();
      var bullet    = (glyphType === DocumentApp.GlyphType.BULLET ||
                       glyphType === DocumentApp.GlyphType.HOLLOW_BULLET ||
                       glyphType === DocumentApp.GlyphType.SQUARE_BULLET) ? '- ' : '1. ';
      lines.push(indent + bullet + paraToMd(item));

    } else if (type === DocumentApp.ElementType.TABLE) {
      var table = child.asTable();
      for (var r = 0; r < table.getNumRows(); r++) {
        var row = table.getRow(r);
        var cells = [];
        for (var c = 0; c < row.getNumCells(); c++) {
          cells.push(row.getCell(c).getText().replace(/\n/g, ' '));
        }
        lines.push('| ' + cells.join(' | ') + ' |');
        if (r === 0) lines.push('| ' + cells.map(function() { return '---'; }).join(' | ') + ' |');
      }
    }
  }

  return { fileId: params.fileId, title: doc.getName(), markdown: lines.join('\n') };
}

function paraToMd(para) {
  var result = '';
  for (var i = 0; i < para.getNumChildren(); i++) {
    var el = para.getChild(i);
    if (el.getType() !== DocumentApp.ElementType.TEXT) continue;
    var t = el.asText();
    var chunk = t.getText();
    if (t.isBold() && t.isItalic()) chunk = '***' + chunk + '***';
    else if (t.isBold())            chunk = '**' + chunk + '**';
    else if (t.isItalic())          chunk = '*' + chunk + '*';
    result += chunk;
  }
  return result;
}

// ---------------------------------------------------------------------------
// drive_read_sheet_csv
// Exports a Google Sheet tab as CSV text.
// Params: { fileId: string, sheetName?: string, range?: string }
// ---------------------------------------------------------------------------
function driveReadSheetCsv(params) {
  if (!params.fileId) throw new Error('fileId is required');

  const ss = SpreadsheetApp.openById(params.fileId);
  var sheet = params.sheetName ? ss.getSheetByName(params.sheetName) : ss.getActiveSheet();
  if (!sheet) throw new Error('Sheet not found: ' + params.sheetName);

  var data = params.range ? sheet.getRange(params.range).getValues() : sheet.getDataRange().getValues();

  var csv = data.map(function(row) {
    return row.map(function(cell) {
      var val = String(cell);
      if (val.indexOf(',') !== -1 || val.indexOf('"') !== -1 || val.indexOf('\n') !== -1) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(',');
  }).join('\n');

  return { fileId: params.fileId, sheetName: sheet.getName(),
           rows: data.length, cols: data[0] ? data[0].length : 0, csv: csv };
}

// ---------------------------------------------------------------------------
// drive_slides_as_text
// Extracts text content from a Google Slides presentation, slide by slide.
// Params: { fileId: string }
// ---------------------------------------------------------------------------
function driveSlidesAsText(params) {
  if (!params.fileId) throw new Error('fileId is required');

  const presentation = SlidesApp.openById(params.fileId);
  const slides = presentation.getSlides();
  var result = [];

  slides.forEach(function(slide, idx) {
    var texts = [];
    slide.getShapes().forEach(function(shape) {
      if (shape.hasText()) {
        var t = shape.getText().asString().trim();
        if (t) texts.push(t);
      }
    });
    result.push({ slideIndex: idx + 1, title: texts[0] || '', text: texts.join('\n') });
  });

  return { fileId: params.fileId, title: presentation.getName(),
           slideCount: slides.length, slides: result };
}

// ---------------------------------------------------------------------------
// drive_organize_files
// Moves an array of fileIds into a target folder.
// Params: { fileIds: string[], targetFolderId: string }
// ---------------------------------------------------------------------------
function driveOrganizeFiles(params) {
  if (!params.fileIds || params.fileIds.length === 0) throw new Error('fileIds array is required');
  if (!params.targetFolderId) throw new Error('targetFolderId is required');

  const targetFolder = DriveApp.getFolderById(params.targetFolderId);
  if (!targetFolder) throw new Error('Target folder not found: ' + params.targetFolderId);

  var moved = [], failed = [];

  params.fileIds.forEach(function(fileId) {
    try {
      var file = DriveApp.getFileById(fileId);
      var parents = file.getParents();
      targetFolder.addFile(file);
      while (parents.hasNext()) {
        var parent = parents.next();
        if (parent.getId() !== targetFolder.getId()) parent.removeFile(file);
      }
      moved.push({ fileId: fileId, name: file.getName() });
    } catch (e) {
      failed.push({ fileId: fileId, error: e.message });
    }
  });

  return { targetFolderId: targetFolder.getId(), targetFolderName: targetFolder.getName(),
           movedCount: moved.length, failedCount: failed.length, moved: moved, failed: failed };
}

// ---------------------------------------------------------------------------
// drive_create_shortcut
// Creates a shortcut to a file inside a folder using Drive API v3.
// Params: { fileId: string, folderId: string }
// ---------------------------------------------------------------------------
function driveCreateShortcut(params) {
  if (!params.fileId)   throw new Error('fileId is required');
  if (!params.folderId) throw new Error('folderId is required');

  var folder = params.folderId === 'root'
    ? DriveApp.getRootFolder()
    : DriveApp.getFolderById(params.folderId);
  if (!folder) throw new Error('Folder not found: ' + params.folderId);

  const file  = DriveApp.getFileById(params.fileId);
  const token = ScriptApp.getOAuthToken();
  const payload = {
    name: file.getName() + ' (Shortcut)',
    mimeType: 'application/vnd.google-apps.shortcut',
    parents: [folder.getId()],
    shortcutDetails: { targetId: params.fileId }
  };
  const response = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    { method: 'post', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload), muteHttpExceptions: true }
  );
  const data = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 200) {
    throw new Error('Shortcut creation failed: ' + (data.error && data.error.message));
  }
  return { shortcutId: data.id, shortcutName: data.name, targetFileId: params.fileId,
           targetName: file.getName(), folderId: folder.getId(), folderName: folder.getName(), url: data.webViewLink };
}

// ---------------------------------------------------------------------------
// drive_manage_permissions
// Add or remove a user's access to a file via Drive API v3.
// Params: { fileId: string, email: string, role?: 'viewer'|'commenter'|'editor', action: 'add'|'remove' }
// ---------------------------------------------------------------------------
function driveManagePermissions(params) {
  if (!params.fileId) throw new Error('fileId is required');
  if (!params.email)  throw new Error('email is required');
  if (!params.action) throw new Error('action is required ("add" or "remove")');

  const token   = ScriptApp.getOAuthToken();
  const baseUrl = 'https://www.googleapis.com/drive/v3/files/' + params.fileId + '/permissions';

  if (params.action === 'add') {
    const role = params.role || 'viewer';
    const driveRole = role === 'editor' ? 'writer' : role;
    const response = UrlFetchApp.fetch(baseUrl + '?sendNotificationEmail=false', {
      method: 'post',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ role: driveRole, type: 'user', emailAddress: params.email }),
      muteHttpExceptions: true
    });
    const data = JSON.parse(response.getContentText());
    if (response.getResponseCode() !== 200) {
      throw new Error('Permission add failed: ' + (data.error && data.error.message));
    }
    return { action: 'add', fileId: params.fileId, email: params.email, role: role, permissionId: data.id };

  } else if (params.action === 'remove') {
    const listResp = UrlFetchApp.fetch(baseUrl + '?fields=permissions(id,emailAddress)', {
      headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
    });
    const listData = JSON.parse(listResp.getContentText());
    var perm = null;
    (listData.permissions || []).forEach(function(p) {
      if (p.emailAddress === params.email) perm = p;
    });
    if (!perm) throw new Error('No permission found for: ' + params.email);
    UrlFetchApp.fetch(baseUrl + '/' + perm.id, {
      method: 'delete', headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
    });
    return { action: 'remove', fileId: params.fileId, email: params.email, permissionId: perm.id };

  } else {
    throw new Error('action must be "add" or "remove"');
  }
}

// ---------------------------------------------------------------------------
// drive_summarize_folder
// Reads names, descriptions, MIME types of up to N files for an AI briefing.
// Params: { folderId: string, maxFiles?: number }
// ---------------------------------------------------------------------------
function driveSummarizeFolder(params) {
  if (!params.folderId) throw new Error('folderId is required');
  const maxFiles = Math.min(params.maxFiles || 10, 20);

  var folder = params.folderId === 'root'
    ? DriveApp.getRootFolder()
    : DriveApp.getFolderById(params.folderId);
  if (!folder) throw new Error('Folder not found: ' + params.folderId);

  var summaries = [];
  var files = folder.getFiles();
  while (files.hasNext() && summaries.length < maxFiles) {
    var file = files.next();
    summaries.push({ fileId: file.getId(), name: file.getName(),
      mimeType: file.getMimeType(), description: file.getDescription() || '',
      modifiedAt: file.getLastUpdated().toISOString(), size: file.getSize() });
  }

  var lines = ['📁 Folder: ' + folder.getName(), '   Files scanned: ' + summaries.length, ''];
  summaries.forEach(function(f) {
    lines.push('  📄 ' + f.name + ' [' + friendlyMime(f.mimeType) + ']' +
      (f.description ? ' — ' + f.description : ''));
  });

  return { folderId: folder.getId(), folderName: folder.getName(),
           fileCount: summaries.length, briefing: lines.join('\n'), files: summaries };
}

function friendlyMime(mime) {
  var map = {
    'application/vnd.google-apps.document':     'Google Doc',
    'application/vnd.google-apps.spreadsheet':  'Google Sheet',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/vnd.google-apps.folder':       'Folder',
    'application/pdf': 'PDF', 'text/plain': 'Text'
  };
  return map[mime] || mime;
}

// ---------------------------------------------------------------------------
// drive_find_and_replace
// Find and replace text across an array of Google Docs.
// Params: { fileIds: string[], find: string, replace: string }
// ---------------------------------------------------------------------------
function driveFindAndReplace(params) {
  if (!params.fileIds || params.fileIds.length === 0) throw new Error('fileIds array is required');
  if (params.find    === undefined) throw new Error('find is required');
  if (params.replace === undefined) throw new Error('replace is required');

  var results = [];
  params.fileIds.forEach(function(fileId) {
    try {
      var doc  = DocumentApp.openById(fileId);
      doc.getBody().replaceText(params.find, params.replace);
      doc.saveAndClose();
      results.push({ fileId: fileId, name: doc.getName(), success: true });
    } catch (e) {
      results.push({ fileId: fileId, success: false, error: e.message });
    }
  });

  return { find: params.find, replace: params.replace,
           filesUpdated: results.filter(function(r) { return r.success; }).length,
           results: results };
}

// ---------------------------------------------------------------------------
// Internal helper — includes sharing info
// ---------------------------------------------------------------------------
function fileToObject(file) {
  var sharingAccess = 'UNKNOWN';
  try { sharingAccess = file.getSharingAccess().toString(); } catch(e) {}
  var editors = [];
  try { editors = file.getEditors().map(function(u) { return u.getEmail(); }); } catch(e) {}
  var viewers = [];
  try { viewers = file.getViewers().map(function(u) { return u.getEmail(); }); } catch(e) {}

  return {
    fileId:        file.getId(),
    name:          file.getName(),
    mimeType:      file.getMimeType(),
    description:   file.getDescription(),
    size:          file.getSize(),
    createdAt:     file.getDateCreated().toISOString(),
    modifiedAt:    file.getLastUpdated().toISOString(),
    url:           file.getUrl(),
    downloadUrl:   file.getDownloadUrl(),
    owners:        file.getOwner() ? [file.getOwner().getEmail()] : [],
    starred:       file.isStarred(),
    trashed:       file.isTrashed(),
    sharingAccess: sharingAccess,
    editors:       editors,
    viewers:       viewers
  };
}
