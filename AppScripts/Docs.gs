/**
 * Google Docs tools
 * All functions are called by the dispatcher in Code.gs
 */

// ---------------------------------------------------------------------------
// docs_create
// Params: { title: string, content?: string }
// ---------------------------------------------------------------------------
function docsCreate(params) {
  if (!params.title) throw new Error('title is required');

  const doc  = DocumentApp.create(params.title);
  const body = doc.getBody();

  if (params.content) {
    body.setText(params.content);
  }

  doc.saveAndClose();

  return {
    docId: doc.getId(),
    title: doc.getName(),
    url:   doc.getUrl()
  };
}

// ---------------------------------------------------------------------------
// docs_get
// Params: { docId: string }
// ---------------------------------------------------------------------------
function docsGet(params) {
  if (!params.docId) throw new Error('docId is required');

  const doc  = DocumentApp.openById(params.docId);
  const body = doc.getBody();

  // Extract structured content: paragraphs with their text and heading style
  const paragraphs = body.getParagraphs().map(function(p) {
    return {
      text:  p.getText(),
      style: p.getHeading().toString()
    };
  });

  return {
    docId:      doc.getId(),
    title:      doc.getName(),
    url:        doc.getUrl(),
    bodyText:   body.getText(),
    paragraphs: paragraphs
  };
}

// ---------------------------------------------------------------------------
// docs_append
// Params: { docId: string, content: string, addNewline?: boolean }
// ---------------------------------------------------------------------------
function docsAppend(params) {
  if (!params.docId)   throw new Error('docId is required');
  if (!params.content) throw new Error('content is required');

  const doc  = DocumentApp.openById(params.docId);
  const body = doc.getBody();

  if (params.addNewline !== false) {
    body.appendParagraph('');
  }

  body.appendParagraph(params.content);
  doc.saveAndClose();

  return {
    docId:     doc.getId(),
    title:     doc.getName(),
    url:       doc.getUrl(),
    appended:  true
  };
}
