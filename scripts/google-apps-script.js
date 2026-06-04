/**
 * Google Apps Script for Restaurant Order Sheet
 * 
 * Install:
 * 1. Open the restaurant's Google Sheet
 * 2. Extensions → Apps Script
 * 3. Delete the default myFunction() code
 * 4. Paste this entire file
 * 5. Save (Ctrl+S)
 * 6. Click the clock icon (Triggers) on the left
 * 7. Click "+ Add Trigger"
 * 8. Choose function: onEdit
 * 9. Choose event source: From spreadsheet
 * 10. Choose event type: On edit
 * 11. Click Save
 * 
 * Make sure the daily order tabs use column Q (17th column) for 狀態 (status).
 */

const WEBHOOK_URL = 'https://lunch.antu-technology.com/api/webhooks/sheet-status'

// Replace this with the api_key from the Master Sheet Restaurants tab
const API_KEY = 'YOUR_RESTAURANT_API_KEY'
const RESTAURANT_SLUG = 'YOUR_RESTAURANT_SLUG'

function onEdit(e) {
  const sheet = e.source.getActiveSheet()
  const range = e.range
  const row = range.getRow()
  const col = range.getColumn()
  
  // Only trigger on column Q (17) status changes in daily tabs (yyyy-MM-dd format)
  if (col !== 17) return
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sheet.getName())) return
  if (row < 2) return // skip header
  
  const orderNumber = sheet.getRange(row, 1).getValue() // column A
  const status = e.value
  
  if (!orderNumber || !status) return
  
  const payload = JSON.stringify({
    orderNumber: String(orderNumber),
    status: String(status),
    restaurantSlug: RESTAURANT_SLUG,
    signature: computeHmac(String(orderNumber) + ':' + String(status) + ':' + RESTAURANT_SLUG, API_KEY),
  })
  
  try {
    UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'POST',
      contentType: 'application/json',
      payload: payload,
      muteHttpExceptions: true,
    })
  } catch (err) {
    console.error('Webhook failed:', err)
  }
}

function computeHmac(message, secret) {
  const signature = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_256,
    message,
    secret
  )
  return Utilities.base64Encode(signature)
}
