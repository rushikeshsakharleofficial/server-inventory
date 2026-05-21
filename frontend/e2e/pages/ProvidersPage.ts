import { type Page, type Locator } from '@playwright/test'

export class ProvidersPage {
  readonly rows: Locator

  constructor(private readonly page: Page) {
    this.rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') })
  }

  async goto(): Promise<void> { await this.page.goto('/providers') }

  toggleButton(rowIndex: number): Locator {
    return this.rows.nth(rowIndex).getByRole('button', { name: /enable|disable|toggle/i })
  }
}
