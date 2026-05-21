import { type Page, type Locator } from '@playwright/test'

export class SyncLogsPage {
  readonly syncButton: Locator
  readonly stopButton: Locator
  readonly rows: Locator
  readonly progressIndicator: Locator

  constructor(private readonly page: Page) {
    this.syncButton = page.getByRole('button', { name: /sync all|start sync/i })
    this.stopButton = page.getByRole('button', { name: /stop/i })
    this.rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') })
    this.progressIndicator = page.getByRole('status').or(page.getByText(/syncing/i))
  }

  async goto(): Promise<void> { await this.page.goto('/sync-logs') }
}
