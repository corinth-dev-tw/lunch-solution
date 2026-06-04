import { test as base, Page } from '@playwright/test'

export interface MockSession {
  memberId: string
  lineUserId: string
  displayName: string
  pictureUrl?: string
}

export const TEST_USER: MockSession = {
  memberId: 'test-member-001',
  lineUserId: 'Utest1234567890',
  displayName: '測試用戶',
  pictureUrl: 'https://example.com/avatar.png',
}

/**
 * Intercept /api/auth/session so the app thinks the user is logged in.
 */
export async function mockAuthSession(page: Page, user: MockSession = TEST_USER) {
  await page.route('/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ session: user }),
    })
  })
}

/**
 * Intercept /api/orders POST so submission succeeds without real Sheets.
 */
export async function mockOrderSubmission(page: Page, orderNumber = 'TEST-20260101-A1B2') {
  await page.route('/api/orders', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          order: { orderNumber, total: 400, status: 'pending' },
        }),
      })
      return
    }
    await route.continue()
  })
}

/**
 * Intercept /api/coupons/validate so coupon checks succeed.
 */
export async function mockCouponValidation(page: Page, discount = 50) {
  await page.route('/api/coupons/validate*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ valid: true, discount }),
    })
  })
}

export const test = base.extend<{
  authedPage: Page
}>({
  authedPage: async ({ page }, use) => {
    await mockAuthSession(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'
