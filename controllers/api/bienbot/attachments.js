/**
 * BienBot — session attachment serving (signed S3 URLs).
 *
 * Split out from `controllers/api/bienbot.js` (bd #f4ed).
 *
 * @module controllers/api/bienbot/attachments
 */

const {
  logger,
  validateObjectId, successResponse, errorResponse,
  BienBotSession,
  retrieveFile,
} = require('./_shared');

/**
 * Get a signed URL for a BienBot session attachment stored in S3.
 * GET /api/bienbot/sessions/:id/attachments/:messageIndex/:attachmentIndex
 */
exports.getAttachmentUrl = async (req, res) => {
  const userId = req.user._id.toString();
  const { id, messageIndex, attachmentIndex } = req.params;

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  const msgIdx = parseInt(messageIndex, 10);
  const attIdx = parseInt(attachmentIndex, 10);
  if (isNaN(msgIdx) || msgIdx < 0 || isNaN(attIdx) || attIdx < 0) {
    return errorResponse(res, null, 'Invalid message or attachment index', 400);
  }

  try {
    const session = await BienBotSession.findById(sessionObjId).lean();
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    // Verify access: owner or collaborator
    const isOwner = session.user.toString() === userId;
    const isCollab = (session.shared_with || []).some(c => c.user_id.toString() === userId);
    if (!isOwner && !isCollab) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    const messages = session.messages || [];
    if (msgIdx >= messages.length) {
      return errorResponse(res, null, 'Message not found', 404);
    }

    const attachments = messages[msgIdx].attachments || [];
    if (attIdx >= attachments.length) {
      return errorResponse(res, null, 'Attachment not found', 404);
    }

    const attachment = attachments[attIdx];
    if (!attachment.s3Key) {
      return errorResponse(res, null, 'Attachment not stored in S3', 404);
    }

    const fileResult = await retrieveFile(attachment.s3Key, {
      protected: attachment.isProtected !== false,
      expiresIn: 3600
    });

    if (!fileResult || !fileResult.signedUrl) {
      return errorResponse(res, null, 'Attachment not available', 404);
    }

    return successResponse(res, {
      url: fileResult.signedUrl,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize
    }, 'Attachment URL generated');
  } catch (err) {
    logger.error('[bienbot] Failed to get attachment URL', { error: err.message, sessionId: id, userId });
    return errorResponse(res, null, 'Failed to get attachment URL', 500);
  }
};


module.exports = {
  getAttachmentUrl: exports.getAttachmentUrl,
};
