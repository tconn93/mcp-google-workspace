/**
 * Gmail tools
 * All functions are called by the dispatcher in Code.gs
 */

// ---------------------------------------------------------------------------
// gmail_search
// Params: { query: string, maxResults?: number }
// ---------------------------------------------------------------------------
function gmailSearch(params) {
  const query = params.query || '';
  const maxResults = Math.min(params.maxResults || 10, 50);

  const threads = GmailApp.search(query, 0, maxResults);

  return threads.map(function(thread) {
    const firstMsg = thread.getMessages()[0];
    return {
      threadId:   thread.getId(),
      snippet:    thread.getLastMessageSubject(),
      subject:    firstMsg.getSubject(),
      from:       firstMsg.getFrom(),
      date:       firstMsg.getDate().toISOString(),
      messageCount: thread.getMessageCount(),
      isUnread:   thread.isUnread(),
      labels:     thread.getLabels().map(function(l) { return l.getName(); })
    };
  });
}

// ---------------------------------------------------------------------------
// gmail_get_message
// Params: { messageId: string }
// ---------------------------------------------------------------------------
function gmailGetMessage(params) {
  if (!params.messageId) throw new Error('messageId is required');

  const msg = GmailApp.getMessageById(params.messageId);
  if (!msg) throw new Error('Message not found: ' + params.messageId);

  return {
    messageId: msg.getId(),
    threadId:  msg.getThread().getId(),
    subject:   msg.getSubject(),
    from:      msg.getFrom(),
    to:        msg.getTo(),
    cc:        msg.getCc(),
    date:      msg.getDate().toISOString(),
    isUnread:  msg.isUnread(),
    isStarred: msg.isStarred(),
    body:      msg.getPlainBody(),
    attachments: msg.getAttachments().map(function(a) {
      return { name: a.getName(), mimeType: a.getContentType(), sizeBytes: a.getSize() };
    })
  };
}

// ---------------------------------------------------------------------------
// gmail_get_messages
// Bulk fetch — returns full message content for all results of a query.
// Params: { query: string, maxResults?: number }
// ---------------------------------------------------------------------------
function gmailGetMessages(params) {
  if (!params.query) throw new Error('query is required');
  const maxResults = Math.min(params.maxResults || 5, 20);

  const threads = GmailApp.search(params.query, 0, maxResults);

  var results = [];
  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(msg) {
      results.push({
        messageId: msg.getId(),
        threadId:  thread.getId(),
        subject:   msg.getSubject(),
        from:      msg.getFrom(),
        to:        msg.getTo(),
        cc:        msg.getCc(),
        date:      msg.getDate().toISOString(),
        isUnread:  msg.isUnread(),
        isStarred: msg.isStarred(),
        body:      msg.getPlainBody(),
        attachments: msg.getAttachments().map(function(a) {
          return { name: a.getName(), mimeType: a.getContentType(), sizeBytes: a.getSize() };
        })
      });
    });
  });

  return results;
}

// ---------------------------------------------------------------------------
// gmail_modify_message
// Mark read/unread, star/unstar, archive, or trash a message.
// Params: { messageId: string, markRead?: boolean, star?: boolean,
//           trash?: boolean, archive?: boolean }
// ---------------------------------------------------------------------------
function gmailModifyMessage(params) {
  if (!params.messageId) throw new Error('messageId is required');

  const msg = GmailApp.getMessageById(params.messageId);
  if (!msg) throw new Error('Message not found: ' + params.messageId);

  const thread = msg.getThread();
  var actions = [];

  if (params.markRead === true)  { msg.markRead();    actions.push('marked_read'); }
  if (params.markRead === false) { msg.markUnread();  actions.push('marked_unread'); }
  if (params.star === true)      { msg.star();        actions.push('starred'); }
  if (params.star === false)     { msg.unstar();      actions.push('unstarred'); }
  if (params.trash === true)     { msg.moveToTrash(); actions.push('trashed'); }

  // Archive = remove from Inbox by moving the whole thread out of Inbox
  if (params.archive === true) {
    thread.moveToArchive();
    actions.push('archived');
  }

  return {
    messageId: msg.getId(),
    threadId:  thread.getId(),
    actionsApplied: actions
  };
}

// ---------------------------------------------------------------------------
// gmail_label_message
// Apply or remove a named label from a thread. Creates the label if needed.
// Params: { threadId: string, labelName: string, action: 'add' | 'remove' }
// ---------------------------------------------------------------------------
function gmailLabelMessage(params) {
  if (!params.threadId)   throw new Error('threadId is required');
  if (!params.labelName)  throw new Error('labelName is required');
  if (!params.action)     throw new Error('action is required ("add" or "remove")');

  const thread = GmailApp.getThreadById(params.threadId);
  if (!thread) throw new Error('Thread not found: ' + params.threadId);

  // Get or create the label
  var label = GmailApp.getUserLabelByName(params.labelName);

  if (params.action === 'add') {
    if (!label) label = GmailApp.createLabel(params.labelName);
    thread.addLabel(label);
  } else if (params.action === 'remove') {
    if (!label) throw new Error('Label not found: ' + params.labelName);
    thread.removeLabel(label);
  } else {
    throw new Error('action must be "add" or "remove", got: ' + params.action);
  }

  return {
    threadId:  thread.getId(),
    labelName: params.labelName,
    action:    params.action,
    success:   true
  };
}

// ---------------------------------------------------------------------------
// gmail_send_draft
// Params: { to: string, subject: string, body: string, cc?: string, bcc?: string }
// ---------------------------------------------------------------------------
function gmailSendDraft(params) {
  if (!params.to)      throw new Error('to is required');
  if (!params.subject) throw new Error('subject is required');
  if (!params.body)    throw new Error('body is required');

  const draft = GmailApp.createDraft(
    params.to,
    params.subject,
    params.body,
    {
      cc:  params.cc  || '',
      bcc: params.bcc || ''
    }
  );

  draft.send();

  return {
    draftId: draft.getId(),
    sent: true,
    to:      params.to,
    subject: params.subject
  };
}
