import { type Page, type Locator } from '@playwright/test'

export class ServersPage {
  readonly searchInput: Locator
  readonly addServerButton: Locator
  readonly tableRows: Locator
  readonly detailPanel: Locator

  constructor(private readonly page: Page) {
    this.searchInput = page.getByPlaceholder(/search/i)
    this.addServerButton = page.getByRole('button', { name: /add server/i })
    this.tableRows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') })
    this.detailPanel = page.getByRole('complementary')
  }

  async goto(): Promise<void> { await this.page.goto('/inventory/servers') }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term)
    await this.page.waitForTimeout(400)
  }

  async clickRow(index: number): Promise<void> {
    await this.tableRows.nth(index).click()
  }
}
