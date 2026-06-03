import { test, expect } from '@playwright/test'
import { RestaurantPage } from '../pages/RestaurantPage'
import { mockAuthSession, mockOrderSubmission, mockCouponValidation } from '../fixtures/authed-test'

test.describe('Full Order Flow', () => {
  let restaurant: RestaurantPage

  test.beforeEach(async ({ page }) => {
    // Mock all external dependencies
    await mockAuthSession(page)
    await mockOrderSubmission(page, 'TEST-20260115-X1Y2')
    await mockCouponValidation(page, 50)

    restaurant = new RestaurantPage(page)
    await restaurant.goto('siammore')
    await restaurant.expectLoaded()
  })

  test('should complete a full order with bento and drink', async ({ page }) => {
    // 1. Select date
    await restaurant.selectDate()

    // 2. Add bentos
    await restaurant.addItem('qtan')
    await restaurant.addItem('basil')

    // 3. Add drink
    await restaurant.addItem('milk-tea')

    // 4. Verify cart
    await expect(page.locator('text=共 3 項')).toBeVisible()

    // 5. Proceed to checkout
    await restaurant.checkoutButton.click()
    await expect(page.locator('text=確認訂單')).toBeVisible()

    // 6. Verify order summary (use item names without qty to avoid strict matching issues)
    await expect(page.locator('text=Q彈好咖餐盒')).toBeVisible()
    await expect(page.locator('text=開胃扒飯餐盒')).toBeVisible()
    await expect(page.locator('text=泰式奶茶')).toBeVisible()

    // 7. Apply coupon
    const couponInput = page.locator('input[placeholder*="優惠碼"]')
    await couponInput.fill('LUNCH50')
    await page.locator('button:has-text("套用")').click()
    await expect(page.locator('text=省下 NT$50')).toBeVisible()

    // 8. Fill customer info
    await restaurant.fillCheckoutForm({
      name: '王大明',
      company: '測試科技',
      phone: '0912-345-678',
    })

    // 9. Submit order
    await restaurant.submitOrder()

    // 10. Verify success page
    await expect(page.locator('text=訂購成功！')).toBeVisible()
    await expect(page.locator('text=TEST-20260115-X1Y2')).toBeVisible()
    await expect(page.locator('text=應付金額')).toBeVisible()
  })

  test('should show validation error for missing required fields', async ({ page }) => {
    await restaurant.selectDate()
    await restaurant.addItem('qtan')
    await restaurant.checkoutButton.click()

    // Try submitting without name/phone
    const submitBtn = page.locator('button:has-text("確認訂購")')
    // Button should be disabled
    await expect(submitBtn).toBeDisabled()

    // Fill only name
    await page.locator('input[placeholder*="王小明"]').fill('王大明')
    await expect(submitBtn).toBeDisabled()

    // Fill phone — now enabled
    await page.locator('input[placeholder*="0912"]').fill('0912-345-678')
    await expect(submitBtn).toBeEnabled()
  })

  test('should allow ordering again after success', async ({ page }) => {
    await restaurant.selectDate()
    await restaurant.addItem('qtan')
    await restaurant.checkoutButton.click()

    await restaurant.fillCheckoutForm({
      name: '王大明',
      phone: '0912-345-678',
    })
    await restaurant.submitOrder()

    // Click "再訂一次"
    await page.locator('button:has-text("再訂一次")').click()

    // Should return to order page with empty cart
    // (date remains selected, so check for empty cart instead)
    await expect(page.locator('text=共 0 項')).toBeVisible()
    await expect(page.locator('text=Q彈好咖餐盒')).toBeVisible()
  })
})
