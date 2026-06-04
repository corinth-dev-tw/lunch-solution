/**
 * Google Apps Script — install in each restaurant's Google Sheet.
 * Extensions → Apps Script → paste this → Save → set up onEdit trigger.
 *
 * Script Properties required (Extensions → Apps Script → Project Settings → Script Properties):
 *   WEBHOOK_URL      = https://lunch.antu-technology.com/api/webhooks/sheet-status
 *   WEBHOOK_SECRET   = <restaurant's api_key from D1 restaurants table>
 *   RESTAURANT_SLUG  = siammore   (must match restaurants.slug in D1)
 */

var STATUS_COL = 17; // Column Q = status

function onEdit(e) {
  if (!e) return;
  var range = e.range;
  if (range.getColumn() !== STATUS_COL) return;
  if (range.getRow() < 2) return; // skip header

  var sheet = range.getSheet();
  var row = range.getRow();
  var orderNumber = sheet.getRange(row, 1).getValue(); // Column A
  if (!orderNumber) return;

  var newStatus = e.value || range.getValue();
  if (!newStatus) return;

  var props = PropertiesService.getScriptProperties();
  var webhookUrl = props.getProperty('WEBHOOK_URL');
  var secret = props.getProperty('WEBHOOK_SECRET');
  var restaurantSlug = props.getProperty('RESTAURANT_SLUG');

  if (!webhookUrl || !secret || !restaurantSlug) {
    Logger.log('Missing Script Properties: WEBHOOK_URL, WEBHOOK_SECRET, RESTAURANT_SLUG');
    return;
  }

  // Generate a unique event ID for dedup
  var eventId = restaurantSlug + ':' + sheet.getName() + ':' + row + ':' + new Date().getTime();

  // HMAC-SHA256 signature over "orderNumber:status:restaurantSlug"
  var payload = orderNumber + ':' + newStatus + ':' + restaurantSlug;
  var signature = computeHmacSha256Base64(secret, payload);

  var body = JSON.stringify({
    orderNumber: orderNumber,
    status: newStatus,
    restaurantSlug: restaurantSlug,
    signature: signature,
    eventId: eventId,
  });

  try {
    var response = UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: body,
      muteHttpExceptions: true,
    });
    Logger.log('Webhook response: ' + response.getResponseCode() + ' ' + response.getContentText());
  } catch (err) {
    Logger.log('Webhook error: ' + err.message);
  }
}

function computeHmacSha256Base64(secret, message) {
  var signature = Utilities.computeHmacSha256Signature(message, secret);
  return Utilities.base64Encode(signature);
}

/**
 * Manual test function — run from Apps Script editor to verify webhook works.
 */
function testWebhook() {
  var testEvent = {
    range: SpreadsheetApp.getActiveSheet().getRange('Q2'),
    value: '🟡 製作中',
  };
  onEdit(testEvent);
}
