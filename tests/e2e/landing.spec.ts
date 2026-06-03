import { test, expect } from '@playwright/test'
import { LandingPage } from '../pages/LandingPage'

test.describe('Landing Page', () => {
  let landing: LandingPage

  test.beforeEach(async ({ page }) => {
    landing = new LandingPage(page)
    await landing.goto()
  })

  test('should load and display title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/百貨餐廳|午餐/)
    await expect(page.locator('text=選擇辦公大樓')).toBeVisible()
  })

  test('should show restaurant list after selecting location and date', async ({ page }) => {
    // Select location
    await page.locator('button:has-text("選擇辦公大樓")').click()
    await page.locator('button:has-text("台北101")').first().click()

    // Select date
    await page.locator('button:has-text("選擇日期")').click()
    await page.locator('button').filter({ hasText: /^\d{4}\/\d{2}\/\d{2}/ }).first().click()

    // Click confirm
    await page.locator('button:has-text("查看餐廳")').click()

    // Should show restaurant section
    await expect(page.locator('text=可訂餐廳')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=饗泰多').first()).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to restaurant page', async ({ page }) => {
    // Select location
    await page.locator('button:has-text("選擇辦公大樓")').click()
    await page.locator('button:has-text("台北101")').first().click()

    // Select date
    await page.locator('button:has-text("選擇日期")').click()
    await page.locator('button').filter({ hasText: /^\d{4}\/\d{2}\/\d{2}/ }).first().click()

    // Click confirm
    await page.locator('button:has-text("查看餐廳")').click()

    // Wait for restaurant card and click
    const siammoreCard = page.locator('button').filter({ hasText: '饗泰多 松高店' })
    await expect(siammoreCard).toBeVisible({ timeout: 10000 })
    await siammoreCard.click()
    await page.waitForURL('/siammore*')
    await expect(page.locator('text=饗泰多')).toBeVisible()
  })
})
