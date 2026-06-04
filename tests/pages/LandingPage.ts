import { Page, Locator } from '@playwright/test'

export class LandingPage {
  readonly page: Page
  readonly mapContainer: Locator
  readonly restaurantCards: Locator

  constructor(page: Page) {
    this.page = page
    this.mapContainer = page.locator('[data-testid="map-container"], .mapboxgl-map, canvas').first()
    this.restaurantCards = page.locator('a[href^="/"]').filter({ hasText: /餐廳|便當|店/ })
  }

  async goto() {
    await this.page.goto('/')
    // Mapbox makes persistent network requests; don't wait for networkidle
    await this.page.waitForLoadState('domcontentloaded')
  }

  async selectLocation(name: string) {
    // Try clicking a map marker or location button
    const marker = this.page.locator(`text=${name}`).first()
    if (await marker.isVisible().catch(() => false)) {
      await marker.click()
    }
  }

  async clickRestaurant(slug: string) {
    await this.page.locator(`a[href="/${slug}"]`).click()
    await this.page.waitForURL(`/${slug}`)
  }

  async expectLoaded() {
    await this.page.waitForSelector('text=信義區午餐外送', { timeout: 10000 })
  }
}
