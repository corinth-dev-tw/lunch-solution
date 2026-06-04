import { Page, Locator } from '@playwright/test'

export class RestaurantPage {
  readonly page: Page
  readonly checkoutButton: Locator
  readonly datePicker: Locator
  readonly loginModal: Locator

  constructor(page: Page) {
    this.page = page
    this.checkoutButton = page.locator('[data-testid="checkout-btn"]')
    this.datePicker = page.locator('button:has-text("選擇日期")')
    this.loginModal = page.locator('[data-testid="login-modal"]')
  }

  async goto(slug: string) {
    await this.page.goto(`/${slug}`)
    await this.page.waitForLoadState('domcontentloaded')
  }

  async expectLoaded() {
    // Wait for loading spinner to disappear
    await this.page.waitForSelector('text=載入中...', { state: 'hidden', timeout: 15000 })
    const notFound = this.page.locator('text=找不到餐廳')
    if (await notFound.isVisible().catch(() => false)) {
      throw new Error('Restaurant not found')
    }
  }

  itemCard(itemId: string): Locator {
    return this.page.locator(`[data-testid="menu-item-${itemId}"]`)
  }

  async addItem(itemId: string) {
    await this.itemCard(itemId).locator(`[data-testid="add-${itemId}"]`).click()
  }

  async removeItem(itemId: string) {
    await this.itemCard(itemId).locator(`[data-testid="remove-${itemId}"]`).click()
  }

  async selectDate() {
    await this.datePicker.click()
    // Pick first available date
    const firstDate = this.page.locator('button').filter({ hasText: /^\d{4}\/\d{2}\/\d{2}/ }).first()
    await firstDate.click()
  }

  async fillCheckoutForm(data: { name: string; company?: string; phone: string }) {
    await this.page.getByPlaceholder('王小明').fill(data.name)
    await this.page.getByPlaceholder('0912-345-678').fill(data.phone)
    if (data.company) {
      await this.page.getByPlaceholder('OO科技').fill(data.company)
    }
  }

  async submitOrder() {
    const submitBtn = this.page.locator('button:has-text("確認訂購")')
    await submitBtn.click()
    await this.page.waitForSelector('text=訂購成功', { timeout: 15000 })
  }

  getItemQty(itemId: string): Locator {
    return this.itemCard(itemId).locator('span').filter({ hasText: /^\d+$/ }).first()
  }
}
