import { test, expect } from '@playwright/test'
import { RestaurantPage } from '../pages/RestaurantPage'

test.describe('Restaurant Page', () => {
  let restaurant: RestaurantPage

  test.beforeEach(async ({ page }) => {
    restaurant = new RestaurantPage(page)
    await restaurant.goto('siammore')
    await restaurant.expectLoaded()
  })

  test('should display restaurant name and menu', async ({ page }) => {
    await expect(page.locator('text=饗泰多')).toBeVisible()
    await expect(page.locator('text=雙主菜 + 三配菜 · 超有料餐盒')).toBeVisible()
    // Menu items should be visible
    await expect(page.locator('text=Q彈好咖餐盒')).toBeVisible()
    await expect(page.locator('text=開胃扒飯餐盒')).toBeVisible()
  })

  test('should add and remove items from cart', async ({ page }) => {
    const itemId = 'qtan'

    // Add item
    await restaurant.addItem(itemId)
    const qty = restaurant.getItemQty(itemId)
    await expect(qty).toHaveText('1')

    // Cart total should update
    await expect(page.locator('text=NT$ 200')).toBeVisible()

    // Add same item again
    await restaurant.addItem(itemId)
    await expect(qty).toHaveText('2')

    // Remove one
    await restaurant.removeItem(itemId)
    await expect(qty).toHaveText('1')

    // Remove last one
    await restaurant.removeItem(itemId)
    // After removing last item, qty element might not exist or be 0
    const qtyAfter = restaurant.getItemQty(itemId)
    const hasQty = await qtyAfter.isVisible().catch(() => false)
    if (hasQty) {
      await expect(qtyAfter).toHaveText('0')
    }
  })

  test('should disable checkout button when cart is empty or no date selected', async ({ page }) => {
    // Checkout button should be disabled initially (no date + empty cart)
    await expect(restaurant.checkoutButton).toBeDisabled()

    // Add item but still no date — should still be disabled
    await restaurant.addItem('qtan')
    await expect(restaurant.checkoutButton).toBeDisabled()

    // Select date — now enabled
    await restaurant.selectDate()
    await expect(restaurant.checkoutButton).toBeEnabled()
  })

  test('should allow checkout when authenticated', async ({ page }) => {
    // Mock auth session
    await page.route('/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            memberId: 'test-001',
            lineUserId: 'Utest123',
            displayName: '測試用戶',
          },
        }),
      })
    })

    // Reload to pick up mocked session
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await restaurant.expectLoaded()

    // Pick date and add item
    await restaurant.selectDate()
    await restaurant.addItem('qtan')

    // Checkout button should be enabled
    await expect(restaurant.checkoutButton).toBeEnabled()
    await restaurant.checkoutButton.click()

    // Should show checkout form
    await expect(page.locator('text=確認訂單')).toBeVisible()
    await expect(page.locator('text=訂購人資訊')).toBeVisible()
  })
})
